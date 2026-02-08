// src/infrastructure/email/email.service.ts

import nodemailer, { Transporter } from 'nodemailer';
import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { Logger } from '../logging/logger';
import { EventSubscriber } from '../events/event-subscriber';
import { DomainEvent } from '../events/event-publisher';

export class EmailService {
  private transporter: Transporter;
  private logger: Logger;
  private eventListenersSetup: boolean = false;
  private templateCache: Map<string, HandlebarsTemplateDelegate> = new Map();

  constructor() {
    this.logger = Logger.getInstance();
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_PORT === '465',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    this.verifyConnection();
  }

  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      this.logger.info('✓ Email service connection verified');
    } catch (error) {
      this.logger.error('✗ Email service connection failed', { error });
    }
  }

  public setupEventListeners(): void {
    if (this.eventListenersSetup) {
      this.logger.warn('Event listeners already setup');
      return;
    }

    const subscriber = new EventSubscriber();

    subscriber.subscribe(
      'email-queue',
      ['auth.user.registered', 'loan.*.submitted', 'loan.*.approved', 'loan.*.rejected'],
      async (event) => {
        await this.handleEvent(event);
      },
    );

    this.eventListenersSetup = true;
    this.logger.info('Email service event listeners setup complete');
  }

  private async handleEvent(event: DomainEvent): Promise<void> {
    try {
      this.logger.info('Handling email event', {
        eventType: event.eventType,
        aggregateId: event.aggregateId,
      });

      switch (event.eventType) {
        case 'user.registered':
          await this.sendWelcomeEmail(event.payload);
          break;
        case 'loan_application.submitted':
          await this.sendApplicationSubmittedEmail(event);
          break;
        case 'loan_application.approved':
          await this.sendApplicationApprovedEmail(event);
          break;
        case 'loan_application.rejected':
          await this.sendApplicationRejectedEmail(event);
          break;
        default:
          this.logger.warn('Unhandled event type', { eventType: event.eventType });
      }
    } catch (error) {
      this.logger.error('Failed to handle email event', {
        eventType: event.eventType,
        error,
      });
    }
  }

  public async sendWelcomeEmail(payload: any): Promise<void> {
    const { email, firstName = 'User', role } = payload;

    const template = this.getTemplate('welcome');
    const html = template({
      firstName,
      email,
      role,
      loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`,
      year: new Date().getFullYear(),
    });

    await this.sendMail({
      to: email,
      subject: 'Welcome to Loan Platform - Registration Successful',
      html,
    });
  }

  public async sendApplicationSubmittedEmail(event: DomainEvent): Promise<void> {
    const { email, amount, term, applicationId } = event.payload;

    const template = this.getTemplate('application-submitted');
    const html = template({
      amount: this.formatCurrency(amount),
      term,
      applicationId,
      submittedDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`,
      year: new Date().getFullYear(),
    });

    await this.sendMail({
      to: email,
      subject: 'Loan Application Submitted Successfully',
      html,
    });

    this.logger.info('Application submitted email sent', { email, applicationId });
  }

  public async sendApplicationApprovedEmail(event: DomainEvent): Promise<void> {
    const { email, amount, term, applicationId, approvedAmount } = event.payload;

    const template = this.getTemplate('application-approved');
    const html = template({
      amount: this.formatCurrency(approvedAmount || amount),
      term,
      applicationId,
      dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`,
      year: new Date().getFullYear(),
    });

    await this.sendMail({
      to: email,
      subject: '🎉 Your Loan Application has been Approved!',
      html,
    });

    this.logger.info('Application approved email sent', { email, applicationId });
  }

  public async sendApplicationRejectedEmail(event: DomainEvent): Promise<void> {
    const { email, applicationId, reason } = event.payload;

    const template = this.getTemplate('application-rejected');
    const html = template({
      applicationId,
      reason: reason || 'Please contact support for more details',
      supportEmail: process.env.SUPPORT_EMAIL || 'support@loanplatform.com',
      year: new Date().getFullYear(),
    });

    await this.sendMail({
      to: email,
      subject: 'Loan Application Update',
      html,
    });

    this.logger.info('Application rejected email sent', { email, applicationId });
  }

  private async sendMail(options: { to: string; subject: string; html: string }): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'Loan Platform <noreply@loanplatform.com>',
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      this.logger.info('✓ Email sent successfully', {
        to: options.to,
        subject: options.subject,
        messageId: info.messageId,
      });
    } catch (error) {
      this.logger.error('✗ Failed to send email', {
        to: options.to,
        subject: options.subject,
        error,
      });
      throw error;
    }
  }

  private getTemplate(templateName: string): HandlebarsTemplateDelegate {
    // Check cache first
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    // Determine the correct template path
    // In development: src/infrastructure/email/templates
    // In production (compiled): dist/infrastructure/email/templates
    const isDevelopment = process.env.NODE_ENV !== 'production';

    let templatePath: string;

    if (isDevelopment) {
      // Development - read from src
      templatePath = path.join(__dirname, 'templates', `${templateName}.hbs`);
    } else {
      // Production - read from dist
      templatePath = path.join(__dirname, 'templates', `${templateName}.hbs`);
    }

    // Log the path being checked for debugging
    this.logger.debug('Looking for template', { templateName, templatePath });

    try {
      if (fs.existsSync(templatePath)) {
        const source = fs.readFileSync(templatePath, 'utf8');
        const template = handlebars.compile(source);

        // Cache the compiled template
        this.templateCache.set(templateName, template);

        this.logger.debug('Template loaded successfully', { templateName });
        return template;
      } else {
        this.logger.warn(`Template file not found: ${templatePath}`);
        return this.getFallbackTemplate(templateName);
      }
    } catch (error) {
      this.logger.error('Error loading template', { templateName, error });
      return this.getFallbackTemplate(templateName);
    }
  }

  private getFallbackTemplate(templateName: string): HandlebarsTemplateDelegate {
    const fallbacks: Record<string, string> = {
      welcome: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>Welcome to Loan Platform!</h1>
          <p>Hello {{firstName}},</p>
          <p>Your account has been created successfully.</p>
          <p><a href="{{loginUrl}}" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Login to Your Account</a></p>
        </div>
      `,
      'application-submitted': `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>Application Submitted</h1>
          <p>Your loan application (ID: {{applicationId}}) has been submitted successfully.</p>
          <p>Amount: {{amount}} | Term: {{term}} months</p>
        </div>
      `,
      'application-approved': `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>🎉 Loan Approved!</h1>
          <p>Congratulations! Your loan application has been approved.</p>
          <p>Amount: {{amount}} | Term: {{term}} months</p>
        </div>
      `,
      'application-rejected': `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>Loan Application Update</h1>
          <p>Your loan application was not approved at this time.</p>
          <p>Reason: {{reason}}</p>
          <p>Contact: {{supportEmail}}</p>
        </div>
      `,
    };

    this.logger.warn(`Using fallback template for: ${templateName}`);
    return handlebars.compile(fallbacks[templateName] || '<p>Notification</p>');
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }
}
