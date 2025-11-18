const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
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
            logger.warn("Warning: Email credentials are not set in environment variables");
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
                    logger.error('Failed to connect to email server:', error);
                } else {
                    logger.info('Email service initialized successfully');
                }
            });

        } catch (error) {
            logger.error('Error configuring email service:', error);
        }
    }

    async sendTeamInvitation(email, teamName, role, inviteUrl) {
        if (!this.transporter) {
            logger.error('Email service not initialized');
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

            logger.info('Email sent successfully:', info.messageId);
            return true;
        } catch (error) {
            logger.error('Error sending email:', error);
            return false;
        }
    }

    async sendPasswordReset(email, resetUrl, userName) {
        if (!this.transporter) {
            logger.error('Email service not initialized');
            return false;
        }

        const htmlTemplate = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Password Reset Request</h2>
            <p>Hello ${userName},</p>
            <p>We received a request to reset your password. If you didn't make this request, please ignore this email.</p>
            <p>Click the link below to reset your password:</p>
            <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px;">
                Reset Password
            </a>
            <p><strong>This link will expire in 1 hour.</strong></p>
            <p>For security reasons, please do not share this link with anyone.</p>
            <p>Best regards,<br>SuperU Team</p>
        </body>
        </html>
        `;

        try {
            const info = await this.transporter.sendMail({
                from: process.env.MAIL_USERNAME,
                to: email,
                subject: 'Password Reset Request',
                html: htmlTemplate
            });

            logger.info('Password reset email sent successfully:', info.messageId);
            return true;
        } catch (error) {
            logger.error('Error sending password reset email:', error);
            return false;
        }
    }

    async sendEmailVerification(email, verificationUrl, userName) {
        if (!this.transporter) {
            logger.error('Email service not initialized');
            return false;
        }

        const htmlTemplate = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Verify Your Email</h2>
            <p>Hello ${userName},</p>
            <p>Thank you for registering! Please verify your email address to activate your account.</p>
            <p>Click the link below to verify your email:</p>
            <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px;">
                Verify Email
            </a>
            <p><strong>This link will expire in 24 hours.</strong></p>
            <p>If you didn't create this account, please ignore this email.</p>
            <p>Best regards,<br>SuperU Team</p>
        </body>
        </html>
        `;

        try {
            const info = await this.transporter.sendMail({
                from: process.env.MAIL_USERNAME,
                to: email,
                subject: 'Verify Your Email Address',
                html: htmlTemplate
            });

            logger.info('Verification email sent successfully:', info.messageId);
            return true;
        } catch (error) {
            logger.error('Error sending verification email:', error);
            return false;
        }
    }
}

module.exports = new EmailService();

