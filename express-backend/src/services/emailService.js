const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
    constructor() {
        this.transporter = null;
        this.initialize();
    }

    initialize() {
        const mailUsername = process.env.MAIL_USERNAME;
        const mailPassword = process.env.MAIL_APP_PASSWORD;

        if (!mailUsername || !mailPassword) {
            console.warn("Warning: Email credentials are not set in environment variables");
            return;
        }

        try {
            this.transporter = nodemailer.createTransport({
                service: 'gmail',
                host: 'smtp.gmail.com',
                port: 587,
                secure: false,
                auth: {
                    user: mailUsername,
                    pass: mailPassword
                },
                debug: true
            });

            // Test the connection
            this.transporter.verify((error, success) => {
                if (error) {
                    console.error('Failed to connect to email server:', error);
                } else {
                    console.log('Email service initialized successfully');
                }
            });

        } catch (error) {
            console.error('Error configuring email service:', error);
        }
    }

    async sendTeamInvitation(email, teamName, role, inviteUrl) {
        if (!this.transporter) {
            console.error('Email service not initialized');
            return false;
        }

        const htmlTemplate = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Team Invitation</h2>
            <p>Hello!</p>
            <p>You've been invited to join ${teamName} as a ${role}.</p>
            <p>Click the link below to accept the invitation:</p>
            <a href="${inviteUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
                Accept Invitation
            </a>
            <p>This invitation will expire in 7 days.</p>
            <p>Best regards,<br>Your Team</p>
        </body>
        </html>
        `;

        try {
            const info = await this.transporter.sendMail({
                from: process.env.MAIL_USERNAME,
                to: email,
                subject: 'Team Invitation',
                html: htmlTemplate
            });

            console.log('Email sent successfully:', info.messageId);
            return true;
        } catch (error) {
            console.error('Error sending email:', error);
            return false;
        }
    }
}

module.exports = new EmailService();

