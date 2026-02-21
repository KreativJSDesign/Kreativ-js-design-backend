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
        });
      } else {
        res.status(500).send("Internal Server Error");
      }
    }
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
};

export const DebugListings = async (req: any, res: any) => {
  try {
    // Check which env vars are loaded (without revealing values)
    const envCheck: any = {
      PORT: !!process.env.PORT,
      MONGODB_URI: !!process.env.MONGODB_URI,
      ETSY_CLIENT_ID: !!process.env.ETSY_CLIENT_ID,
      ETSY_CLIENT_ID_preview: process.env.ETSY_CLIENT_ID
        ? process.env.ETSY_CLIENT_ID.substring(0, 4) + "..."
        : "MISSING",
      ETSY_CLIENT_SECRET: !!process.env.ETSY_CLIENT_SECRET,
      ETSY_STORE_SECTION_ID: !!process.env.ETSY_STORE_SECTION_ID,
      ETSY_STORE_SECTION_ID_value: process.env.ETSY_STORE_SECTION_ID || "MISSING",
      NODE_ENV: process.env.NODE_ENV || "MISSING",
    };

    const userInfo = await UserModel.findOne({
      username: "jaynayinfo@gmail.com",
    });
    if (!userInfo?.access_token) {
      return res.status(404).json({ error: "No user or access token found", envCheck });
    }

    const accessToken = await refreshAccessToken(userInfo);
    if (!accessToken) {
      return res.status(401).json({ error: "Failed to refresh access token", envCheck });
    }

    const sectionId = process.env.ETSY_STORE_SECTION_ID;
    const apiKey = process.env.ETSY_CLIENT_ID!;
    const debugInfo: any = {
      store_id: userInfo.store_id,
      env_section_id: sectionId,
      token_refreshed: true,
      api_key_length: apiKey.length,
      api_key_trimmed_length: apiKey.trim().length,
      api_key_has_whitespace: apiKey !== apiKey.trim(),
      envCheck,
    };

    // Fetch all shop sections
    const sectionsResponse = await axios.get(
      `https://openapi.etsy.com/v3/application/shops/${userInfo.store_id}/sections`,
      {
        headers: {
          "x-api-key": apiKey.trim(),
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    debugInfo.shop_sections = sectionsResponse.data.results?.map((s: any) => ({
      shop_section_id: s.shop_section_id,
      title: s.title,
    }));

    // Check if configured section exists
    const matchedSection = sectionsResponse.data.results?.find(
      (s: any) => s.shop_section_id === parseInt(sectionId || "0"),
    );
    debugInfo.section_matched = !!matchedSection;
    debugInfo.matched_section_title = matchedSection?.title || null;

    // Try fetching listings for the configured section
    if (matchedSection) {
      const listingsResponse = await axios.get(
        `https://openapi.etsy.com/v3/application/shops/${userInfo.store_id}/listings`,
        {
          headers: {
            "x-api-key": process.env.ETSY_CLIENT_ID!,
            Authorization: `Bearer ${accessToken}`,
          },
          params: {
            shop_section_id: parseInt(sectionId || "0"),
            limit: 10,
            include_private: true,
          },
        },
      );

      debugInfo.listings_count = listingsResponse.data.results?.length || 0;
      debugInfo.listings_sample = listingsResponse.data.results?.map(
        (l: any) => ({
          listing_id: l.listing_id,
          title: l.title,
          state: l.state,
          shop_section_id: l.shop_section_id,
        }),
      );
    }

    return res.status(200).json(debugInfo);
  } catch (error: any) {
    return res.status(500).json({
      error: "Debug failed",
      details: error.response?.data || error.message,
      envCheck: {
        PORT: !!process.env.PORT,
        MONGODB_URI: !!process.env.MONGODB_URI,
        ETSY_CLIENT_ID: !!process.env.ETSY_CLIENT_ID,
        ETSY_CLIENT_ID_preview: process.env.ETSY_CLIENT_ID
          ? process.env.ETSY_CLIENT_ID.substring(0, 4) + "..."
          : "MISSING",
        ETSY_CLIENT_SECRET: !!process.env.ETSY_CLIENT_SECRET,
        ETSY_STORE_SECTION_ID: !!process.env.ETSY_STORE_SECTION_ID,
        ETSY_STORE_SECTION_ID_value: process.env.ETSY_STORE_SECTION_ID || "MISSING",
        NODE_ENV: process.env.NODE_ENV || "MISSING",
      },
    });
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
