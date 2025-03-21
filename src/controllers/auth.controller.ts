import jwt from "jsonwebtoken";
import UserModel, { AdminUserDocument } from "../model/userModel";

export const adminLogin = async (req: any, res: any) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Please provide username and password" });
    }

    const user: AdminUserDocument | null = await UserModel.findOne({ username })
      .select("+password")
      .exec();

    if (!user || !(await user.comparePassword(password))) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const token = generateToken(user._id.toString());

    return res.status(200).json({
      status: "success",
      token,
      user: {
        id: user._id,
        username: user.username,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const adminRegister = async (req: any, res: any) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Please provide username and password" });
    }

    // Check if user exists
    const existingUser = await UserModel.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ error: "Username already exists" });
    }

    // Create new user
    const newUser = new UserModel({ username, password, email });
    await newUser.save();

    return res.status(201).json({
      status: "success",
      message: "User registered successfully",
      user: { id: newUser._id, userName: newUser.username },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const generateToken = (userId: string) => {
  return jwt.sign({ identifier: userId }, process.env.JWT_SECRET as string, {
    expiresIn: process.env.JWT_EXPIRES_IN
      ? parseInt(process.env.JWT_EXPIRES_IN)
      : "1d",
  });
};
