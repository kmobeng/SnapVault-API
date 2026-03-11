import nodemailer from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";

const sendEmail = async (options: any) => {
  if (process.env.NODE_ENV === "production") {
    // sendgrid
    return nodemailer.createTransport({
      service: "SendGrid",
      auth: {
        user: process.env.SENDGRID_USERNAME,
        pass: process.env.SENDGRID_PASSWORD
      }
    })
  }

  // nodemailer
  const transporter = nodemailer.createTransport({
    host: "localhost",
    port: 1025,
    secure: false,
  } as SMTPTransport.MailOptions);

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: options.email,
    subject: options.subject,
    text: options.message,
  };

  await transporter.sendMail(mailOptions);
};

export default sendEmail;
