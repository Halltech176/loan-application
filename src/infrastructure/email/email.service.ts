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
      [
        'auth.user.registered',
        'loan_application.loan_application.submitted',
        'loan_application.loan_application.approved',
        'loan_application.loan_application.rejected',
        'credit_approval.credit_approval.created',
        'disbursement.disbursement.completed',
        'repayment_schedule.repayment_schedule.created',
        'repayment_schedule.repayment_schedule.payment_recorded',
        'repayment_schedule.repayment_schedule.completed',
        'repayment_reminder.repayment_schedule.upcoming',
        'repayment_reminder.repayment_schedule.overdue',
        'repayment_reminder.repayment_schedule.due_today',
      ],
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
        case 'credit_approval.created':
          await this.sendCreditApprovalEmail(event);
          break;
        case 'disbursement.completed':
          await this.sendDisbursementCompletedEmail(event);
          break;
        case 'repayment_schedule.created':
          await this.sendRepaymentScheduleCreatedEmail(event);
          break;
        case 'repayment_schedule.payment_recorded':
          await this.sendPaymentRecordedEmail(event);
          break;
        case 'repayment_schedule.completed':
          await this.sendLoanCompletedEmail(event);
          break;
        case 'repayment_reminder.upcoming':
          await this.sendUpcomingPaymentReminderEmail(event);
          break;
        case 'repayment_reminder.overdue':
          await this.sendOverduePaymentReminderEmail(event);
          break;
        case 'repayment_reminder.due_today':
          await this.sendPaymentDueTodayEmail(event);
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
    const { email, amount, term, firstName } = event.payload;

    const template = this.getTemplate('application-submitted');
    const html = template({
      firstName,
      amount: this.formatCurrency(amount),
      term,
      applicationId: event.aggregateId,
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

    this.logger.info('Application submitted email sent', {
      email,
      applicationId: event.aggregateId,
    });
  }

  public async sendApplicationApprovedEmail(event: DomainEvent): Promise<void> {
    const { email, amount, term, firstName } = event.payload;

    const template = this.getTemplate('application-approved');
    const html = template({
      firstName,
      amount: this.formatCurrency(amount),
      term,
      applicationId: event.aggregateId,
      dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`,
      year: new Date().getFullYear(),
    });

    await this.sendMail({
      to: email,
      subject: '🎉 Your Loan Application has been Approved!',
      html,
    });

    this.logger.info('Application approved email sent', {
      email,
      applicationId: event.aggregateId,
    });
  }

  public async sendApplicationRejectedEmail(event: DomainEvent): Promise<void> {
    const { email, reason, firstName } = event.payload;

    const template = this.getTemplate('application-rejected');
    const html = template({
      firstName,
      applicationId: event.aggregateId,
      reason: reason || 'Please contact support for more details',
      supportEmail: process.env.SUPPORT_EMAIL || 'support@loanplatform.com',
      year: new Date().getFullYear(),
    });

    await this.sendMail({
      to: email,
      subject: 'Loan Application Update',
      html,
    });

    this.logger.info('Application rejected email sent', {
      email,
      applicationId: event.aggregateId,
    });
  }

  public async sendCreditApprovalEmail(event: DomainEvent): Promise<void> {
    const { email, decision, creditScore, firstName } = event.payload;

    const template = this.getTemplate('credit-approval');
    const html = template({
      firstName,
      decision,
      creditScore,
      isApproved: decision === 'approved',
      applicationId: event.payload.loanApplicationId,
      dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`,
      year: new Date().getFullYear(),
    });

    await this.sendMail({
      to: email,
      subject: `Credit ${decision === 'approved' ? 'Approved' : 'Decision'} - Application Update`,
      html,
    });

    this.logger.info('Credit approval email sent', { email, decision });
  }

  public async sendDisbursementCompletedEmail(event: DomainEvent): Promise<void> {
    const { email, amount, transactionReference, firstName } = event.payload;

    const template = this.getTemplate('disbursement-completed');
    const html = template({
      firstName,
      amount: this.formatCurrency(amount),
      transactionReference,
      disbursementDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`,
      year: new Date().getFullYear(),
    });

    await this.sendMail({
      to: email,
      subject: '💰 Loan Funds Disbursed Successfully',
      html,
    });

    this.logger.info('Disbursement completed email sent', { email, transactionReference });
  }

  public async sendRepaymentScheduleCreatedEmail(event: DomainEvent): Promise<void> {
    const { email, numberOfInstallments, totalAmount, firstName } = event.payload;

    const template = this.getTemplate('repayment-schedule-created');
    const html = template({
      firstName,
      numberOfInstallments,
      totalAmount: this.formatCurrency(totalAmount),
      dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/repayments`,
      year: new Date().getFullYear(),
    });

    await this.sendMail({
      to: email,
      subject: 'Your Repayment Schedule is Ready',
      html,
    });

    this.logger.info('Repayment schedule created email sent', { email });
  }

  public async sendPaymentRecordedEmail(event: DomainEvent): Promise<void> {
    const { email, paymentAmount, remainingBalance, firstName } = event.payload;

    const template = this.getTemplate('payment-recorded');
    const html = template({
      firstName,
      paymentAmount: this.formatCurrency(paymentAmount),
      remainingBalance: this.formatCurrency(remainingBalance),
      paymentDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/repayments`,
      year: new Date().getFullYear(),
    });

    await this.sendMail({
      to: email,
      subject: '✅ Payment Received Successfully',
      html,
    });

    this.logger.info('Payment recorded email sent', { email, paymentAmount });
  }

  public async sendLoanCompletedEmail(event: DomainEvent): Promise<void> {
    const { email, totalPaid, firstName } = event.payload;

    const template = this.getTemplate('loan-completed');
    const html = template({
      firstName,
      totalPaid: this.formatCurrency(totalPaid),
      completionDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`,
      year: new Date().getFullYear(),
    });

    await this.sendMail({
      to: email,
      subject: '🎊 Congratulations! Loan Fully Repaid',
      html,
    });

    this.logger.info('Loan completed email sent', { email });
  }

  public async sendUpcomingPaymentReminderEmail(event: DomainEvent): Promise<void> {
    const { email, amount, dueDate, daysUntilDue, firstName } = event.payload;

    const template = this.getTemplate('payment-reminder-upcoming');
    const html = template({
      firstName,
      amount: this.formatCurrency(amount),
      dueDate: new Date(dueDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      daysUntilDue,
      paymentUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/repayments`,
      year: new Date().getFullYear(),
    });

    await this.sendMail({
      to: email,
      subject: `⏰ Payment Due in ${daysUntilDue} Days`,
      html,
    });

    this.logger.info('Upcoming payment reminder sent', { email, daysUntilDue });
  }

  public async sendOverduePaymentReminderEmail(event: DomainEvent): Promise<void> {
    const { email, amount, daysOverdue, firstName } = event.payload;

    const template = this.getTemplate('payment-reminder-overdue');
    const html = template({
      firstName,
      amount: this.formatCurrency(amount),
      daysOverdue,
      paymentUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/repayments`,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@loanplatform.com',
      year: new Date().getFullYear(),
    });

    await this.sendMail({
      to: email,
      subject: '⚠️ Overdue Payment Notice',
      html,
    });

    this.logger.info('Overdue payment reminder sent', { email, daysOverdue });
  }

  public async sendPaymentDueTodayEmail(event: DomainEvent): Promise<void> {
    const { email, amount, firstName } = event.payload;

    const template = this.getTemplate('payment-due-today');
    const html = template({
      firstName,
      amount: this.formatCurrency(amount),
      paymentUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/repayments`,
      year: new Date().getFullYear(),
    });

    await this.sendMail({
      to: email,
      subject: '🔔 Payment Due Today',
      html,
    });

    this.logger.info('Payment due today reminder sent', { email });
  }

  private async sendMail(options: { to: string; subject: string; html: string }): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'Loan Platform <noreply@loanplatform.com>',
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      this.logger.info('Email sent successfully', {
        to: options.to,
        subject: options.subject,
        messageId: info.messageId,
      });
    } catch (error) {
      this.logger.error('Failed to send email', {
        to: options.to,
        subject: options.subject,
        error,
      });
      throw error;
    }
  }

  private getTemplate(templateName: string): HandlebarsTemplateDelegate {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    // const isDevelopment = process.env.NODE_ENV !== 'production';
    const templatePath = path.join(__dirname, 'templates', `${templateName}.hbs`);

    this.logger.debug('Looking for template', { templateName, templatePath });

    try {
      if (fs.existsSync(templatePath)) {
        const source = fs.readFileSync(templatePath, 'utf8');
        const template = handlebars.compile(source);
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
          <p>Hello {{firstName}},</p>
          <p>Your loan application has been submitted successfully.</p>
          <p><strong>Amount:</strong> {{amount}}<br><strong>Term:</strong> {{term}} months</p>
        </div>
      `,
      'application-approved': `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>🎉 Loan Approved!</h1>
          <p>Hello {{firstName}},</p>
          <p>Congratulations! Your loan application has been approved.</p>
          <p><strong>Amount:</strong> {{amount}}<br><strong>Term:</strong> {{term}} months</p>
        </div>
      `,
      'application-rejected': `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>Loan Application Update</h1>
          <p>Hello {{firstName}},</p>
          <p>Your loan application was not approved at this time.</p>
          <p><strong>Reason:</strong> {{reason}}</p>
        </div>
      `,
      'credit-approval': `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>Credit Approval Decision</h1>
          <p>Hello {{firstName}},</p>
          <p>Your credit has been {{#if isApproved}}approved{{else}}reviewed{{/if}}.</p>
          <p><strong>Credit Score:</strong> {{creditScore}}</p>
        </div>
      `,
      'disbursement-completed': `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>💰 Funds Disbursed</h1>
          <p>Hello {{firstName}},</p>
          <p>Your loan amount of {{amount}} has been disbursed.</p>
          <p><strong>Reference:</strong> {{transactionReference}}</p>
        </div>
      `,
      'repayment-schedule-created': `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>Repayment Schedule Ready</h1>
          <p>Hello {{firstName}},</p>
          <p>Your repayment schedule has been created.</p>
          <p><strong>Installments:</strong> {{numberOfInstallments}}<br><strong>Total:</strong> {{totalAmount}}</p>
        </div>
      `,
      'payment-recorded': `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>Payment Received</h1>
          <p>Hello {{firstName}},</p>
          <p>Payment of {{paymentAmount}} received.</p>
          <p><strong>Remaining:</strong> {{remainingBalance}}</p>
        </div>
      `,
      'loan-completed': `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>Loan Completed!</h1>
          <p>Hello {{firstName}},</p>
          <p>Congratulations! You've fully repaid your loan.</p>
        </div>
      `,
      'payment-reminder-upcoming': `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>Payment Reminder</h1>
          <p>Hello {{firstName}},</p>
          <p>Your payment of {{amount}} is due in {{daysUntilDue}} days.</p>
        </div>
      `,
      'payment-reminder-overdue': `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>Overdue Payment</h1>
          <p>Hello {{firstName}},</p>
          <p>Your payment of {{amount}} is {{daysOverdue}} days overdue.</p>
        </div>
      `,
      'payment-due-today': `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>Payment Due Today</h1>
          <p>Hello {{firstName}},</p>
          <p>Your payment of {{amount}} is due today.</p>
        </div>
      `,
    };

    this.logger.warn(`Using fallback template for: ${templateName}`);
    return handlebars.compile(fallbacks[templateName] || '<p>Notification</p>');
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  }
}
