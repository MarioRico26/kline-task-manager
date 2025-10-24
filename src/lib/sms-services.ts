import twilio from 'twilio';

class SMSService {
  private client: twilio.Twilio | null = null;
  private fromNumber: string = '';

  constructor() {
    this.initialize();
  }

  private initialize() {
    try {
      console.log('🔍 SMS Service - Initializing with env vars:', {
        hasSID: !!process.env.TWILIO_ACCOUNT_SID,
        hasToken: !!process.env.TWILIO_AUTH_TOKEN,
        hasPhone: !!process.env.TWILIO_PHONE_NUMBER,
        SID: process.env.TWILIO_ACCOUNT_SID ? 'SET' : 'MISSING',
        token: process.env.TWILIO_AUTH_TOKEN ? 'SET' : 'MISSING',
        phone: process.env.TWILIO_PHONE_NUMBER || 'MISSING'
      });

      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        console.error('❌ SMS Service - Missing Twilio credentials');
        return;
      }

      // Validar formato del Account SID (debe empezar con AC)
      if (!process.env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
        console.error('❌ SMS Service - Invalid Account SID format');
        return;
      }

      this.client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      this.fromNumber = process.env.TWILIO_PHONE_NUMBER!;
      
      console.log('✅ SMS Service - Initialized successfully');
    } catch (error) {
      console.error('❌ SMS Service - Initialization failed:', error);
    }
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
    
    console.log('🔍 SMS Service - Starting sendTaskNotification:', {
      customerPhone,
      customerName,
      taskData,
      type,
      hasClient: !!this.client
    });

    // Verificar que el servicio esté inicializado
    if (!this.client) {
      console.error('❌ SMS Service - Client not initialized');
      return { success: false, error: 'SMS service not configured' };
    }

    // Validar que tenga número
    if (!customerPhone) {
      console.log('❌ SMS Service - No phone number provided');
      return { success: false, error: 'No phone number provided' };
    }

    console.log('🔍 SMS Service - Raw customer phone:', customerPhone);

    // Formatear número
    const formattedPhone = this.formatPhoneNumber(customerPhone);
    if (!formattedPhone) {
      console.log('❌ SMS Service - Invalid phone number format after formatting:', customerPhone);
      return { success: false, error: 'Invalid phone number format' };
    }

    console.log('🔍 SMS Service - Formatted phone:', formattedPhone);

    // Crear mensaje
    const message = this.buildMessage(customerName, taskData, type);
    console.log('🔍 SMS Service - Message content:', message);
    console.log('🔍 SMS Service - Message length:', message.length);

    // Verificar que el mensaje no esté vacío
    if (!message || message.length === 0) {
      console.error('❌ SMS Service - Empty message generated');
      return { success: false, error: 'Empty message' };
    }

    try {
      console.log('🔍 SMS Service - Attempting to send via Twilio...', {
        from: this.fromNumber,
        to: formattedPhone,
        messageLength: message.length
      });

      // INTENTAR ENVIAR EL SMS
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: formattedPhone
      });

      console.log('✅ SMS Service - SMS sent successfully!', {
        sid: result.sid,
        status: result.status,
        dateCreated: result.dateCreated
      });

      return { success: true };

    } catch (error: any) {
      console.error('❌ SMS Service - SMS sending FAILED:', {
        errorCode: error.code,
        errorMessage: error.message,
        errorMoreInfo: error.moreInfo,
        errorStatus: error.status,
        errorDetails: error.details
      });

      // Error específico de número no verificado
      if (error.code === 21211) {
        console.error('❌ SMS Service - Phone number is not verified in Twilio trial');
        return { 
          success: false, 
          error: 'Phone number not verified in Twilio trial account. Please verify this number in Twilio console.' 
        };
      }

      // Error de límite de trial
      if (error.code === 21408) {
        console.error('❌ SMS Service - Trial account limit reached');
        return { 
          success: false, 
          error: 'Trial account limit reached. Please upgrade Twilio account or wait 24 hours.' 
        };
      }

      return { 
        success: false, 
        error: error.message || 'Unknown Twilio error occurred' 
      };
    }
  }

  private formatPhoneNumber(phone: string): string | null {
    if (!phone) {
      console.log('🔍 SMS Service - formatPhoneNumber: No phone provided');
      return null;
    }

    console.log('🔍 SMS Service - formatPhoneNumber input:', phone);

    // Limpiar el número
    const cleaned = phone.replace(/\D/g, '');
    console.log('🔍 SMS Service - formatPhoneNumber cleaned:', cleaned);

    // Si ya tiene +1, dejarlo como está
    if (cleaned.startsWith('1') && cleaned.length === 11) {
      const result = `+${cleaned}`;
      console.log('🔍 SMS Service - formatPhoneNumber result (11 digits):', result);
      return result;
    }
    
    // Si tiene 10 dígitos, agregar +1
    if (cleaned.length === 10) {
      const result = `+1${cleaned}`;
      console.log('🔍 SMS Service - formatPhoneNumber result (10 digits):', result);
      return result;
    }
    
    // Si tiene 11 dígitos y empieza con 1, agregar +
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      const result = `+${cleaned}`;
      console.log('🔍 SMS Service - formatPhoneNumber result (11 digits with 1):', result);
      return result;
    }

    console.warn('⚠️ SMS Service - formatPhoneNumber: Formato no soportado:', {
      original: phone,
      cleaned: cleaned,
      length: cleaned.length
    });
    return null;
  }

  private buildMessage(
    customerName: string, 
    taskData: { service: string; scheduledFor?: Date | string | null; status?: string; propertyAddress?: string },
    type: 'creation' | 'update'
  ): string {
    console.log('🔍 SMS Service - buildMessage called with:', { customerName, taskData, type });
    
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

    const message = `Thank you for choosing Kline Bros. Landscaping & Pool Company. ${serviceLine}${addressLine}${dateLine} Please call 609-494-5838 with any questions. We look forward to working with you.

Thank you,

Kline Bros. Landscaping & Pool Company`;

    console.log('🔍 SMS Service - buildCreationMessage result:', message);
    return message;
  }

  private buildUpdateMessage(
    customerName: string,
    taskData: { service: string; status?: string; propertyAddress?: string }
  ): string {
    const serviceLine = `We are writing to inform you that your ${taskData.service} service`;
    const addressLine = taskData.propertyAddress ? ` at ${taskData.propertyAddress}` : '';
    const statusLine = taskData.status ? ` has been updated to: ${taskData.status}.` : ' has been updated.';

    const message = `Thank you for choosing Kline Bros. Landscaping & Pool Company. ${serviceLine}${addressLine}${statusLine} Please call 609-494-5838 with any questions. We look forward to working with you.

Thank you,

Kline Bros. Landscaping & Pool Company`;

    console.log('🔍 SMS Service - buildUpdateMessage result:', message);
    return message;
  }
}

export const smsService = new SMSService();