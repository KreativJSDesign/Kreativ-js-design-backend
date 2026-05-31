import axios from "axios";
import UserModel from "../model/userModel";
import { refreshAccessToken } from "./newOrder.controller";
import TransactionModel from "../model/transactionModel";
import {
  getListingsBySection,
  sendEmailNotification,
} from "../middleware/listingProduct";
const imaps = require("imap-simple");
const { simpleParser } = require("mailparser");
const cheerio = require("cheerio");


export async function fetchEmails() {
  let connection: any = null;
  try {
    const config = {
      imap: {
        user: process.env.User_Email,
        password: process.env.User_Password,
        host: "imap.gmail.com",
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 5000,
        socketTimeout: 5000,
      },
    };

    console.log("⏳ Connecting to IMAP...");

    try {
      connection = await imaps.connect(config);
      console.log("✅ Connected to IMAP!");
    } catch (err) {
      console.error("❌ IMAP Connection Error:", err);
      return; // Exit early to prevent breaking the app
    }

    const userInfo = await UserModel.findOne({
      username: "jaynayinfo@gmail.com",
    });

    if (!userInfo?.access_token) {
      console.warn("⚠️ No access token found.");
      return;
    }

    const accessToken = await refreshAccessToken(userInfo);
    if (!accessToken) {
      console.warn("⚠️ Failed to refresh access token.");
      return;
    }

    let listingData = null;
    if (process.env.ETSY_STORE_SECTION_ID) {
      try {
        const digitalScratchCardData = await getListingsBySection(
          userInfo?.store_id,
          parseInt(process.env.ETSY_STORE_SECTION_ID),
          accessToken,
        );

        if (!digitalScratchCardData.response || !digitalScratchCardData.Data) {
          console.warn("⚠️ No listing data found.");
          return;
        }
        listingData = digitalScratchCardData.Data;
      } catch (error) {
        console.error("❌ Error fetching Etsy store listings:", error);
        return;
      }
    } else {
      console.warn("⚠️ ETSY_STORE_SECTION_ID is not defined.");
      return;
    }

    await connection.openBox("INBOX");

    const formatDate = (date: Date): string => {
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      return `${date.getDate().toString().padStart(2, "0")}-${months[date.getMonth()]}-${date.getFullYear()}`;
    };

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(today.getDate() - 2);

    const searchCriteria = [
      ["SINCE", formatDate(twoDaysAgo)],
      ["BEFORE", formatDate(tomorrow)],
    ];

    const fetchOptions = { bodies: ["HEADER", "TEXT"], markSeen: false };
    let results = [];

    try {
      results = await connection.search(searchCriteria, fetchOptions);
    } catch (error) {
      console.error("❌ Error searching emails:", error);
      return;
    }

    for (const res of results) {
      try {
        if (!res.parts) continue;

        const headerPart = res.parts.find(
          (part: { which: string }) => part.which === "HEADER",
        );
        const textPart = res.parts.find(
          (part: { which: string }) => part.which === "TEXT",
        );
        const subject = headerPart?.body.subject?.[0] || "No Subject";
        const parsedEmail = await simpleParser(textPart?.body || "");
        const $ = cheerio.load(parsedEmail.html || parsedEmail.text || "");

        // Find buyer email link — must be a mailto: link
        const emailLink = $("a").filter(
          (i: any, el: any) => {
            const href = $(el).attr("href") || "";
            const text = $(el).text().trim();
            // Only accept mailto: links with exact label matches
            return href.startsWith("mailto:") && (
              text === "Send them an email" ||
              text === "Sende dem Käufer eine E-Mail"
            );
          }
        );
        const email =
          emailLink.attr("href")?.replace("mailto:", "") || "Not Found";

        const textContent = $.text();
        // Try multiple patterns to extract transaction ID
        const transactionMatch =
          textContent.match(/(Transaction ID|Transaktions-Nr\.|Transaktions-ID)[.:\s]*(\d{10,})/i) ||
          parsedEmail.text?.match(/(Transaction ID|Transaktions-Nr\.|Transaktions-ID)[.:\s]*(\d{10,})/i);

        const transactionID = transactionMatch
          ? transactionMatch[2]
          : "Not Found";

        if (transactionID === "Not Found") {
          console.error("❌ Error fetching transaction ID");
          continue;
        }
        console.log(`✅ Found transaction ID: ${transactionID}, buyer email: ${email}`);

        const transactionHistory = await TransactionModel.findOne({
          transaction_id: transactionID,
        });
        if (transactionHistory) {
          console.log(`⏭️ Transaction ${transactionID} already processed, skipping`);
          continue;
        }

        let transactionData;
        try {
          const response = await axios.get(
            `https://openapi.etsy.com/v3/application/shops/${userInfo.store_id}/transactions/${transactionID}`,
            {
              headers: {
                "x-api-key": `${process.env.ETSY_CLIENT_ID}:${process.env.ETSY_CLIENT_SECRET}`,
                Authorization: `Bearer ${accessToken}`,
              },
            },
          );
          transactionData = response.data;
        } catch (error: any) {
          console.error(
            `❌ Error fetching transaction ID ${transactionID}:`,
            error.response?.data || error.message,
          );
          continue;
        }

        console.log(`🔍 Transaction listing_id: ${transactionData.listing_id}, checking section...`);

        if (
          listingData.some(
            (item) => item.listing_id === transactionData.listing_id,
          )
        ) {
          
          const NewTransaction = {
            transaction_id: transactionData.transaction_id,
            listing_id: transactionData.listing_id,
            customerEmail: email,
            lastDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          };

          try {
            const transactionInfo =
              await TransactionModel.create(NewTransaction);
            const scratchCardLink = `${process.env.NODE_ENV === "production" ? process.env.FRONTEND_URL_PROD : process.env.FRONTEND_URL_LOCAL}/customize-card/${transactionInfo._id}`;
            await sendEmailNotification(email, scratchCardLink);
          } catch (error: any) {
            console.error("❌ Error saving transaction:", error);
          }
        } else {
          console.warn(`⚠️ Listing ID ${transactionData.listing_id} not found in section ${process.env.ETSY_STORE_SECTION_ID}`);
        }
      } catch (error) {
        console.error("❌ Error processing email:", error);
      }
    }
  } catch (error) {
    console.error("❌ Unexpected Error in fetchEmails:", error);
  } finally {
    if (connection) {
      try {
        connection.end();
        console.log("🔄 IMAP connection closed.");
      } catch (error) {
        console.error("❌ Error closing IMAP connection:", error);
      }
    }
  }
}

export async function debugEmailFlow() {
  const logs: string[] = [];
  let connection: any = null;

  try {
    // 1. Check env vars
    logs.push(`User_Email: ${process.env.User_Email ? "✅ set (" + process.env.User_Email + ")" : "❌ MISSING"}`);
    logs.push(`User_Password: ${process.env.User_Password ? "✅ set" : "❌ MISSING"}`);
    logs.push(`ETSY_STORE_SECTION_ID: ${process.env.ETSY_STORE_SECTION_ID || "❌ MISSING"}`);

    // 2. Try IMAP connection
    const config = {
      imap: {
        user: process.env.User_Email,
        password: process.env.User_Password,
        host: "imap.gmail.com",
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 5000,
        socketTimeout: 5000,
      },
    };

    try {
      connection = await imaps.connect(config);
      logs.push("✅ IMAP connected successfully");
    } catch (err: any) {
      logs.push(`❌ IMAP connection failed: ${err.message}`);
      return { logs };
    }

    // 3. Check inbox
    await connection.openBox("INBOX");
    logs.push("✅ Inbox opened");

    const formatDate = (date: Date): string => {
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      return `${date.getDate().toString().padStart(2, "0")}-${months[date.getMonth()]}-${date.getFullYear()}`;
    };

    // Search last 3 days to catch test purchases
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const searchCriteria = [["SINCE", formatDate(threeDaysAgo)]];
    const fetchOptions = { bodies: ["HEADER", "TEXT"], markSeen: false };
    const results = await connection.search(searchCriteria, fetchOptions);

    logs.push(`📧 Emails found (last 3 days): ${results.length}`);

    // 4. Check for Etsy order emails and parse content
    let etsyOrderEmails = 0;
    for (const res of results.slice(0, 20)) {
      if (!res.parts) continue;
      const headerPart = res.parts.find((p: any) => p.which === "HEADER");
      const textPart = res.parts.find((p: any) => p.which === "TEXT");
      const subject = headerPart?.body.subject?.[0] || "";
      const from = headerPart?.body.from?.[0] || "";
      if (from.toLowerCase().includes("etsy") || subject.toLowerCase().includes("bestellung") || subject.toLowerCase().includes("order")) {
        etsyOrderEmails++;
        logs.push(`  📦 Subject: "${subject}"`);

        // Try to parse transaction ID
        try {
          const parsedEmail = await simpleParser(textPart?.body || "");
          const $ = cheerio.load(parsedEmail.html || parsedEmail.text || "");
          const textContent = $.text();

          const transactionMatch = textContent.match(/(Transaction ID|Transaktions-Nr\.)[:\s]*(\d+)/);
          logs.push(`  🔢 Transaction ID: ${transactionMatch ? transactionMatch[2] : "NOT FOUND"}`);

          const emailLink = $("a").filter((i: any, el: any) =>
            $(el).text().trim() === "Send them an email" || $(el).text().trim() === "Sende dem Käufer eine E-Mail"
          );
          logs.push(`  📧 Buyer email link: ${emailLink.attr("href") ? "FOUND" : "NOT FOUND"}`);
        } catch (e: any) {
          logs.push(`  ⚠️ Parse error: ${e.message}`);
        }
      }
    }
    logs.push(`📦 Etsy order emails found: ${etsyOrderEmails}`);

    return { logs };
  } catch (error: any) {
    logs.push(`❌ Error: ${error.message}`);
    return { logs };
  } finally {
    if (connection) {
      try { connection.end(); } catch (_) {}
    }
  }
}
