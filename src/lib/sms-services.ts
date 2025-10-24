import twilio from 'twilio';

class SMSService {
  private client: twilio.Twilio;
  private fromNumber: string;

  constructor() {
    // DEBUG: Verificar que las variables existen
    console.log('🔍 SMS Service - Environment check:', {
      hasAccountSid: !!process.env.TWILIO_ACCOUNT_SID,
      hasAuthToken: !!process.env.TWILIO_AUTH_TOKEN,
      hasPhoneNumber: !!process.env.TWILIO_PHONE_NUMBER,
      accountSidLength: process.env.TWILIO_ACCOUNT_SID?.length,
      authTokenLength: process.env.TWILIO_AUTH_TOKEN?.length
    });

    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials are missing');
    }

    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER!;
  }

  async sendTaskNotification(
    customerPhone: string, 
    customerName: string, 
    taskData: { 
      service: string; 
      scheduledFor?: Date | string | null;
      status?: string;
      propertyAddress?: string;
    },
    type: 'creation' | 'update'
  ): Promise<{ success: boolean; error?: string }> {
    
    console.log('🔍 SMS Service - Attempting to send SMS:', {
      customerPhone,
      customerName,
      taskData,
      type
    });

    // Validar que tenga número
    if (!customerPhone) {
      console.log('❌ SMS Service - No phone number provided');
      return { success: false, error: 'No phone number provided' };
    }

    // Formatear número (agregar +1 si no lo tiene)
    const formattedPhone = this.formatPhoneNumber(customerPhone);
    if (!formattedPhone) {
      console.log('❌ SMS Service - Invalid phone number format:', customerPhone);
      return { success: false, error: 'Invalid phone number format' };
    }

    console.log('🔍 SMS Service - Formatted phone:', formattedPhone);

    // Crear mensaje según tipo
    const message = this.buildMessage(customerName, taskData, type);
    console.log('🔍 SMS Service - Message content:', message);

    try {
      // Enviar SMS
      console.log('🔍 SMS Service - Sending via Twilio...');
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: formattedPhone
      });

      console.log('✅ SMS Service - SMS sent successfully:', result.sid);
      return { success: true };

    } catch (error: any) {
      console.error('❌ SMS Service - SMS sending failed:', error);
      console.error('❌ SMS Service - Error details:', {
        code: error.code,
        message: error.message,
        moreInfo: error.moreInfo
      });
      return { 
        success: false, 
        error: error.message || 'Unknown error occurred' 
      };
    }
  }

  // ... el resto del código permanece igual
  private formatPhoneNumber(phone: string): string | null {
    if (!phone) return null;

    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('1') && cleaned.length === 11) {
      return `+${cleaned}`;
    }
    
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }
    
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    }

    console.warn('⚠️ SMS Service - Formato de teléfono no soportado:', phone, 'cleaned:', cleaned);
    return null;
  }

  private buildMessage(
    customerName: string, 
    taskData: { service: string; scheduledFor?: Date | string | null; status?: string; propertyAddress?: string },
    type: 'creation' | 'update'
  ): string {
    if (type === 'creation') {
      return this.buildCreationMessage(customerName, taskData);
    } else {
      return this.buildUpdateMessage(customerName, taskData);
    }
  }

  private buildCreationMessage(
    customerName: string,
    taskData: { service: string; scheduledFor?: Date | string | null; propertyAddress?: string }
  ): string {
    const serviceLine = `We are writing to inform you that your ${taskData.service} service`;
    const addressLine = taskData.propertyAddress ? ` at ${taskData.propertyAddress}` : '';
    
    let dateLine = '';
    if (taskData.scheduledFor) {
      const date = typeof taskData.scheduledFor === 'string' 
        ? new Date(taskData.scheduledFor) 
        : taskData.scheduledFor;
      dateLine = ` has been scheduled for ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`;
    } else {
      dateLine = ' has been created.';
    }

    return `Thank you for choosing Kline Bros. Landscaping & Pool Company. ${serviceLine}${addressLine}${dateLine} Please call 609-494-5838 with any questions. We look forward to working with you.

Thank you,

Kline Bros. Landscaping & Pool Company`;
  }

  private buildUpdateMessage(
    customerName: string,
    taskData: { service: string; status?: string; propertyAddress?: string }
  ): string {
    const serviceLine = `We are writing to inform you that your ${taskData.service} service`;
    const addressLine = taskData.propertyAddress ? ` at ${taskData.propertyAddress}` : '';
    const statusLine = taskData.status ? ` has been updated to: ${taskData.status}.` : ' has been updated.';

    return `Thank you for choosing Kline Bros. Landscaping & Pool Company. ${serviceLine}${addressLine}${statusLine} Please call 609-494-5838 with any questions. We look forward to working with you.

Thank you,

Kline Bros. Landscaping & Pool Company`;
  }
}

export const smsService = new SMSService();