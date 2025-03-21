import fetch from "node-fetch";
import { ETSY_CONFIG } from "../config/constants";
import UserModel from "../model/userModel";

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
}

export const exchangeCodeForToken = async (
  code: string,
): Promise<TokenResponse> => {
  const response = await fetch(`${ETSY_CONFIG.BASE_URL}/public/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: process.env.ETSY_CLIENT_ID,
      redirect_uri:
        process.env.NODE_ENV === "production"
          ? process.env.BACKEND_URL_PROD
          : process.env.BACKEND_URL_LOCAL,
      code,
      code_verifier: ETSY_CONFIG.CLIENT_VERIFIER,
    }),
  });

  if (!response.ok) throw new Error("Token exchange failed");
  return response.json();
};

export const fetchUserData = async (accessToken: string) => {
  const userId = accessToken.split(".")[0];
  const response = await fetch(
    `${ETSY_CONFIG.BASE_URL}/application/users/${userId}`,
    {
      headers: {
        "x-api-key": process.env.ETSY_CLIENT_ID as string,
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) throw new Error("User data fetch failed");
  return response.json();
};
export const saveEtsyUser = async (userData: any) => {
  try {
    const existingUser = await UserModel.findOne({ username: userData.email });

    if (existingUser) {
      // Update existing user
      await UserModel.updateOne({ username: userData.email }, userData);
      console.log(`✅ Updated user: ${userData.store_name}`);
    } else {
      // Create new user
      await UserModel.create(userData);
      console.log(`✅ New user saved: ${userData.store_name}`);
    }
  } catch (error) {
    console.error("❌ Error saving user:", error);
  }
};
