import axios from "axios";
import { Request, Response } from "express";
import { exchangeCodeForToken, saveEtsyUser } from "../services/etsy.service";
import { ETSY_CONFIG } from "../config/constants";
import UserModel from "../model/userModel";
import { refreshAccessToken } from "./newOrder.controller";

export const initiateAuth = async (_req: Request, res: Response) => {
  try {
    const userInfo = await UserModel.findOne({ email: "jaynayinfo@gmail.com" });

    if (userInfo?.access_token) {
      const accessToken = await refreshAccessToken(userInfo);
      if (accessToken) {
        const redirectUrl = `${
          process.env.NODE_ENV === "production"
            ? process.env.FRONTEND_URL_PROD
            : process.env.FRONTEND_URL_LOCAL
        }/designs`;
        res.json({ url: redirectUrl });
        return;
      }
    }
    const authUrl = `https://www.etsy.com/oauth/connect?response_type=code&redirect_uri=${
      process.env.NODE_ENV === "production"
        ? process.env.BACKEND_URL_PROD
        : process.env.BACKEND_URL_LOCAL
    }&scope=email_r profile_r shops_r listings_r listings_w transactions_r&client_id=${
      process.env.ETSY_CLIENT_ID
    }&state=superstring&code_challenge=${ETSY_CONFIG.CODE_CHALLENGE}&code_challenge_method=S256`;

    res.json({ url: authUrl });
  } catch (error) {
    console.error("Error initiating OAuth:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const handleRedirect = async (req: Request, res: Response) => {
  try {
    const authCode = req.query.code as string;
    const tokenData = await exchangeCodeForToken(authCode);

    // Fetch user/store details from Etsy API
    const userInfo = await fetchEtsyUserInfo(tokenData.access_token);

    // Save user data in the database
    await saveEtsyUser({
      store_id: userInfo.shop_id,
      store_name: userInfo.shop_name,
      email: "jaynayinfo@gmail.com",
      owner_name: "jaynay",
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
    });

    res.redirect(
      `${
        process.env.NODE_ENV === "production"
          ? process.env.FRONTEND_URL_PROD
          : process.env.FRONTEND_URL_LOCAL
      }/designs`,
    );
  } catch (error) {
    console.error("Error in handleRedirect:", error);
    res.status(500).send("Internal Server Error");
  }
};

export async function fetchEtsyUserInfo(accessToken: string) {
  try {
    console.log("🔍 Fetching Etsy user info...");

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "x-api-key": process.env.ETSY_CLIENT_ID!,
    };

    // Fetch user details
    const userResponse = await axios.get(
      "https://openapi.etsy.com/v3/application/users/me",
      {
        headers,
      },
    );

    console.log("✅ User response:", userResponse.data);

    const user = userResponse.data;
    if (!user.user_id || !user.shop_id)
      throw new Error("❌ User ID or Shop ID missing");

    // Fetch shop details using Shop ID
    const shopResponse = await axios.get(
      `https://openapi.etsy.com/v3/application/shops/${user.shop_id}`,
      { headers },
    );

    console.log("✅ Shop response:", shopResponse.data);

    const shop = shopResponse.data;

    if (!shop.shop_name) throw new Error("❌ Shop name not found in response");

    return {
      shop_id: shop.shop_id,
      shop_name: shop.shop_name,
      email: user.email || "Email not provided by Etsy",
      owner: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
    };
  } catch (error: any) {
    console.error(
      "❌ Error fetching Etsy user info:",
      error.response?.data || error,
    );
    throw new Error("Failed to fetch user details");
  }
}

export const handleRefreshToken = async (req: any, res: any) => {
  try {
    const userInfo = await UserModel.findOne({ username: "jaynayinfo@gmail.com" });
    if (!userInfo?.refresh_token) {
      return res.status(401).json({ error: "No refresh token found" });
    }

    const response = await axios.post(
      "https://api.etsy.com/v3/public/oauth/token",
      new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.ETSY_CLIENT_ID!,
        client_secret: process.env.ETSY_CLIENT_SECRET!,
        refresh_token: userInfo.refresh_token,
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    const { access_token, refresh_token } = response.data;

    userInfo.access_token = access_token;
    userInfo.refresh_token = refresh_token;
    await userInfo.save();

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Etsy token refresh failed:", error);
    res.status(401).json({ error: "Authentication failed" });
  }
};
