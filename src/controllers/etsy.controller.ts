import axios, { AxiosResponse } from "axios";
import UserModel from "../model/userModel";
import { refreshAccessToken } from "./newOrder.controller";
import { getListingsBySection } from "../middleware/listingProduct";

// interface WebhookPayload {
//   event_name: string;
//   callback_url: string;
//   shop_id: string | number;
// }

// interface EtsyWebhookResponse {
//   id: string;
//   event_name: string;
//   callback_url: string;
//   shop_id: string;
//   created_at: string;
// }

export const GetScracthCardProducts = async (req: any, res: any) => {
  try {
    const userInfo = await UserModel.findOne({
      username: "jaynayinfo@gmail.com",
    });
    if (!userInfo?.access_token) {
      return res.status(404).json({
        message: "Invaild or Missing Etsy Access Token",
        status: false,
      });
    }
    const accessToken = await refreshAccessToken(userInfo);
    if (accessToken) {
      if (process.env.ETSY_STORE_SECTION_ID) {
        const digitalScratchCardData = await getListingsBySection(
          userInfo?.store_id,
          parseInt(process.env.ETSY_STORE_SECTION_ID),
          accessToken,
        );

        if (!digitalScratchCardData.response || !digitalScratchCardData.Data) {
          return res
            .status(400)
            .json({ message: "No listings found", status: false });
        }
        return res.status(200).json({
          status: "success",
          products: digitalScratchCardData.Data,
          // count: digitalScratchCardData.Data.count,
        });
      } else {
        res.status(500).send("Internal Server Error");
      }
    }
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
};

export const CreateOrderWebhook = async (req: any, res: any): Promise<void> => {
  try {
    const userInfo = await UserModel.findOne({ username: "jaynayinfo@gmail.com" });
    if (!userInfo?.access_token || !userInfo?.store_id) {
      res.status(400).json({ error: "Missing user data or auth token" });
      return;
    }

    const accessToken = await refreshAccessToken(userInfo);
    if (!accessToken) {
      res.status(401).json({ error: "Failed to refresh access token" });
      return;
    }

    const shopId = userInfo.store_id;

    const webhookPayload = {
      event_name: "listings.update",
      callback_url: `${
        process.env.NODE_ENV === "production"
          ? process.env.BACKEND_URL_PROD?.replace(`/${process.env.REDIRECT_URI}`, "")
          : process.env.BACKEND_URL_LOCAL?.replace(`/${process.env.REDIRECT_URI}`, "")
      }/api/etsy/etsy-webhook`,
      shop_id: shopId,
    };

    const response: AxiosResponse = await axios.post(
      `https://openapi.etsy.com/v3/application/shops/${shopId}/webhooks`,
      webhookPayload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "x-api-key": process.env.ETSY_CLIENT_ID,
          "Content-Type": "application/json",
        },
      },
    );

    res.status(200).json(response.data);
  } catch (error: any) {
    console.error(
      "Webhook Creation Error:",
      error.response?.data || error.message,
    );
    res.status(500).json({
      error: "Webhook creation failed",
      details: error.response?.data || error.message,
    });
  }
};

export const EtsyWebhookHandler = async (req: any, res: any) => {
  const payload = req.body;

  try {
    console.log("📦 Listing Updated:", JSON.stringify(payload, null, 2));

    // Acknowledge receipt immediately (Etsy expects a quick response)
    res.status(200).send("Webhook received");

    // Process asynchronously after acknowledging
    const userInfo = await UserModel.findOne({ username: "jaynayinfo@gmail.com" });
    if (!userInfo?.access_token) {
      console.error("❌ No user/token found to process webhook");
      return;
    }

    const accessToken = await refreshAccessToken(userInfo);
    if (!accessToken) {
      console.error("❌ Failed to refresh token for webhook processing");
      return;
    }

    // If the webhook includes listing_id, re-fetch the updated listing
    if (payload.listing_id) {
      try {
        const response = await axios.get(
          `https://openapi.etsy.com/v3/application/listings/${payload.listing_id}`,
          {
            headers: {
              "x-api-key": process.env.ETSY_CLIENT_ID!,
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );
        console.log("✅ Refreshed listing data:", response.data.title, response.data.state);
      } catch (error: any) {
        console.error("❌ Error fetching updated listing:", error.response?.data || error.message);
      }
    }
  } catch (error: any) {
    console.error("❌ Webhook Handling Error:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Error processing webhook", details: error.message });
    }
  }
};
