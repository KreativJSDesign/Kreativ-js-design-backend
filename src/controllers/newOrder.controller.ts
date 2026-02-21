import axios from "axios";
import nodemailer from "nodemailer";
import dotenvExpand from "dotenv-expand";
import UserModel from "../model/userModel";
import dotenv from "dotenv";
const env = dotenv.config();
dotenvExpand.expand(env);

let lastProcessedOrderId: number | null = null; // Store in DB for persistence

export const fetchLatestOrders = async () => {
  try {
    let userInfo = await UserModel.findOne({ client_id: "EtsyScratchCard" });
    if (!userInfo) {
      console.log("❌ No user info found.");
      return;
    }

    let accessToken = userInfo.access_token;

    // Step 1: Fetch all active product listings
    let storeListings = await fetchStoreListings(
      accessToken,
      userInfo.store_id,
    );

    // If fetching listings failed due to token expiry, refresh the token and retry
    if (!storeListings.length) {
      console.log("🔄 Attempting to refresh access token...");
      accessToken = await refreshAccessToken(userInfo);
      if (!accessToken) return; // Stop if token refresh fails
      storeListings = await fetchStoreListings(accessToken, userInfo.store_id);
    }

    console.log(`✅ Fetched ${storeListings.length} store listings.`);

    // Step 2: Fetch recent orders
    let response;
    try {
      response = await axios.get(
        `https://openapi.etsy.com/v3/application/shops/${userInfo.store_id}/receipts`,
        {
          headers: {
            "x-api-key": `${process.env.ETSY_CLIENT_ID}:${process.env.ETSY_CLIENT_SECRET}`,
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.log("🔄 Access token expired. Refreshing...");
        accessToken = await refreshAccessToken(userInfo);
        if (!accessToken) return;
        response = await axios.get(
          `https://openapi.etsy.com/v3/application/shops/${userInfo.store_id}/receipts`,
          {
            headers: {
              "x-api-key": `${process.env.ETSY_CLIENT_ID}:${process.env.ETSY_CLIENT_SECRET}`,
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );
      } else {
        throw error;
      }
    }

    const orders = response.data.results;
    console.log("🛍 Recent orders:", orders);

    const newOrders = orders.filter(
      (order: any) =>
        lastProcessedOrderId === null ||
        order.receipt_id > lastProcessedOrderId,
    );

    if (newOrders.length > 0) {
      console.log("📦 New Orders Found:", newOrders);

      for (const order of newOrders) {
        const orderItems = await fetchOrderItems(
          order.receipt_id,
          accessToken,
          userInfo.store_id,
        );

        const isMatchingProduct = orderItems.some((item: any) =>
          storeListings.includes(item.listing_id),
        );

        if (isMatchingProduct) {
          console.log(
            `✅ Order ${order.receipt_id} contains a store product. Sending email...`,
          );
          await sendEmailNotification(order);
        }
      }

      lastProcessedOrderId = newOrders[0].receipt_id;
    } else {
      console.log("✅ No new orders.");
    }
  } catch (error: any) {
    console.error(
      "❌ Error fetching Etsy orders:",
      error.response?.data || error,
    );
  }
};

const fetchStoreListings = async (accessToken: string, shopId: string) => {
  try {
    const response = await axios.get(
      `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/active`,
      {
        headers: {
          "x-api-key": `${process.env.ETSY_CLIENT_ID}:${process.env.ETSY_CLIENT_SECRET}`,
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    return response.data.results.map((listing: any) => listing.listing_id);
  } catch (error: any) {
    console.error(
      "❌ Error fetching store listings:",
      error.response?.data || error,
    );
    return [];
  }
};
// Function to fetch order items
const fetchOrderItems = async (
  receiptId: number,
  accessToken: string,
  shopId: string,
) => {
  try {
    const response = await axios.get(
      `https://openapi.etsy.com/v3/application/shops/${shopId}/receipts/${receiptId}/transactions`,
      {
        headers: {
          "x-api-key": `${process.env.ETSY_CLIENT_ID}:${process.env.ETSY_CLIENT_SECRET}`,
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    return response.data.results;
  } catch (error: any) {
    console.error(
      `❌ Error fetching items for order ${receiptId}:`,
      error.response?.data || error,
    );
    return [];
  }
};

// Function to send an email
async function sendEmailNotification(order: any) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_SENDER!,
      pass: process.env.EMAIL_PASSWORD!,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_SENDER!,
    to: order.email,
    subject: `New Order Received: ${order.receipt_id}`,
    text: `You have a new order that includes your target product!\n\nOrder ID: ${order.receipt_id}\nBuyer: ${order.buyer_email}\nTotal: ${order.total_price} ${order.currency_code}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📩 Email sent successfully for order ${order.receipt_id}`);
  } catch (error) {
    console.error(
      `❌ Error sending email for order ${order.receipt_id}:`,
      error,
    );
  }
}

// Schedule the function to run every 4 minutes
export const refreshAccessToken = async (userInfo: any) => {
  try {
    const response = await axios.post(
      "https://api.etsy.com/v3/public/oauth/token",
      new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.ETSY_CLIENT_ID!,
        client_secret: process.env.ETSY_CLIENT_SECRET!,
        refresh_token: userInfo.refresh_token!,
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    // Update user access token in the database
    userInfo.access_token = response.data.access_token;
    userInfo.refresh_token = response.data.refresh_token; // Store the new refresh token
    await userInfo.save();

    console.log("🔄 Access token refreshed successfully.");
    return response.data.access_token;
  } catch (error: any) {
    console.error(
      "❌ Error refreshing access token:",
      error.response?.data || error,
    );
    return null;
  }
};
