import axios from "axios";
import nodemailer from "nodemailer";

export const getListingsBySection = async (
  shopId: string,
  sectionId: number,
  accessToken: string,
) => {
  try {
    const sectionsResponse = await axios.get(
      `https://openapi.etsy.com/v3/application/shops/${shopId}/sections`,
      {
        headers: {
          "x-api-key": process.env.ETSY_CLIENT_ID!,
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (
      !sectionsResponse.data.results ||
      sectionsResponse.data.results.length === 0
    ) {
      return { response: false, Data: null };
    }

    const validSection = sectionsResponse.data.results.find(
      (sec: any) => sec.shop_section_id === sectionId,
    );

    if (!validSection) {
      return { response: false, Data: null };
    }

    let allListings: any[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const response = await axios.get(
        `https://openapi.etsy.com/v3/application/shops/${shopId}/listings`,
        {
          headers: {
            "x-api-key": process.env.ETSY_CLIENT_ID!,
            Authorization: `Bearer ${accessToken}`,
          },
          params: {
            shop_section_id: sectionId,
            limit,
            offset,
            include_private: true,
          },
        },
      );

      if (!response.data || !response.data.results.length) {
        break;
      }

      allListings.push(...response.data.results);
      offset += limit;

      if (response.data.results.length < limit) {
        break;
      }
    }

    const activeListings = allListings.filter((listing: any) => {
      return (
        listing.shop_section_id === sectionId && listing.state === "active"
      );
    });

    return { response: true, Data: activeListings };
  } catch (error: any) {
    console.error(
      "❌ Error fetching listings:",
      error.response?.data || error.message,
    );
    return { response: false, Data: null };
  }
};

export function findTransactionById(receipts: any[], transactionId: number) {
  console.log(transactionId);
  for (const receipt of receipts) {
    const transaction = receipt.transactions.find(
      (t: any) => t.transaction_id === transactionId,
    );
    if (transaction) {
      return { receipt, transaction };
    }
  }
  return null;
}

export const sendEmailNotification = async (
  email: string,
  scratchCardLink: string,
) => {
  try {
    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.User_Email,
        pass: process.env.User_Password,
      },
    });

    let mailOptions = {
      from: process.env.User_Email,
      to: email,
      subject: "Your Digital Scratch Card is Ready!",
      html: `    
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Scratch Card Link</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              background-color: #f4f4f4;
              text-align: center;
              padding: 40px;
            }
            .email-container {
              background: #fff;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.1);
              max-width: 500px;
              margin: auto;
            }
            .email-header {
              font-size: 24px;
              color: #333;
              margin-bottom: 20px;
            }
            .scratch-card-button {
              display: inline-block;
              background: #701BFF;
              color: white !important;
              padding: 12px 25px;
              font-size: 18px;
              font-weight: bold;
              text-decoration: none;
              border-radius: 6px;
              margin-top: 20px;
            }
            .scratch-card-button:hover {
              background: #5A17CC;
            }
            .copy-container {
              margin-top: 20px;
              font-size: 14px;
              color: #666;
            }
            .copy-box {
              width: 100%;
              padding: 10px;
              border: 1px solid #ccc;
              border-radius: 6px;
              text-align: center;
              background: #f9f9f9;
              word-break: break-all;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <h2 class="email-header">🎉 Your Scratch Card is Ready! 🎉</h2>
            <p>Click the button below to reveal your digital scratch card.</p>
            <a href="${scratchCardLink}" class="scratch-card-button">Reveal Scratch Card</a>

            <div class="copy-container">
                   <p>Or copy the link below:</p>
                  <a href="${scratchCardLink}" style="color: #701BFF; text-decoration: underline;">
                         ${scratchCardLink}
               </a>
            </div>
            <p style="margin-top: 20px; font-size: 14px; color: #666;">
              If you didn't request this, please ignore this email.
            </p>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: " + info.response);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};
