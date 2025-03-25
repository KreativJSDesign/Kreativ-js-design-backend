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
    const shopify_auth_token = userInfo?.access_token;
    if (!shopify_auth_token) {
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
          shopify_auth_token,
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
    const { access_token } = req.body;
    console.log("🔑 Access Token:", access_token);

    if (!access_token) {
      res.status(400).json({ error: "Missing Shopify auth token" });
      return;
    }

    // Uncomment if dynamic shop ID is required
    // const shopId: string | number = await getShopID(access_token);
    const shopId = 27282245; // Currently hardcoded

    const webhookPayload = {
      event_name: "listings.update",
      callback_url: "https://kreativjsdesignapi.vercel.app/api/etsy/listings",
      shop_id: shopId,
    };

    const response: AxiosResponse = await axios.post(
      `https://openapi.etsy.com/v3/application/shops/${shopId}/webhooks`,
      webhookPayload,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
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

export const EtsyWebhookHandler = (req: any, res: any) => {
  const payload = req.body;
  console.log(payload);

  try {
    console.log("📦 Listing Updated:", JSON.stringify(payload, null, 2));

    // TODO: Process the updated listing (e.g., update database, trigger emails)

    res.status(200).send("Webhook received");
  } catch (error: any) {
    // console.log(error);

    console.error("Webhook Handling Error:", error.message);
    res
      .status(500)
      .json({ error: "Error processing webhook", details: error.message });
  }
};
