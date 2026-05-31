import { Router, Request, Response } from "express";
import { fetchEmails, debugEmailFlow } from "../../controllers/email.controller";
import nodemailer from "nodemailer";
// eslint-disable-next-line @typescript-eslint/no-unused-vars

const router = Router();

// Protected cron endpoint — called by external cron service every 4 minutes
router.post("/fetch-emails", async (req: Request, res: Response) => {
  const secret = req.headers["x-cron-secret"];
  if (secret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    console.log("⏰ Cron triggered: fetchEmails");
    await fetchEmails(); // await so Vercel doesn't kill the function early
    res.status(200).json({ status: "ok", message: "fetchEmails completed" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint — runs email flow and returns detailed logs
router.post("/debug-emails", async (req: Request, res: Response) => {
  const secret = req.headers["x-cron-secret"];
  if (secret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const result = await debugEmailFlow();
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Test SMTP sending
router.post("/test-email", async (req: Request, res: Response) => {
  const secret = req.headers["x-cron-secret"];
  if (secret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const testEmail = (req.body as any).email || process.env.User_Email;
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.User_Email,
        pass: process.env.User_Password,
      },
    });

    await transporter.verify();
    const info = await transporter.sendMail({
      from: process.env.User_Email,
      to: testEmail,
      subject: "SMTP Test - Railway",
      text: "Diese Email wurde von Railway via SMTP Port 587 gesendet.",
    });
    res.status(200).json({ success: true, response: info.response, to: testEmail });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
