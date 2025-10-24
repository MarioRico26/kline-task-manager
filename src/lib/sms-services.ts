import twilio from 'twilio';

class SMSService {
  private client: twilio.Twilio;
  private fromNumber: string;

  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER!;
  }

  async sendTaskNotification(
    customerPhone: string, 
    customerName: string, 
    taskData: { 
      service: string; 
      scheduledFor?: Date | string | null;  // ← CAMBIAR AQUÍ: Date | string | null
      status?: string;
      propertyAddress?: string;
    },
    type: 'creation' | 'update'
  ): Promise<{ success: boolean; error?: string }> {
    
    // Validar que tenga número
    if (!customerPhone) {
      return { success: false, error: 'No phone number provided' };
    }

    // Formatear número (agregar +1 si no lo tiene)
    const formattedPhone = this.formatPhoneNumber(customerPhone);
    if (!formattedPhone) {
      return { success: false, error: 'Invalid phone number format' };
    }

    // Crear mensaje según tipo
    const message = this.buildMessage(customerName, taskData, type);

    try {
      // Enviar SMS
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: formattedPhone
      });

      console.log('✅ SMS sent successfully:', result.sid);
      return { success: true };

    } catch (error: any) {
      console.error('❌ SMS sending failed:', error);
      return { 
        success: false, 
        error: error.message || 'Unknown error occurred' 
      };
    }
  }

  private formatPhoneNumber(phone: string): string | null {
    if (!phone) return null;

    // Limpiar el número (quitar espacios, guiones, paréntesis, etc.)
    const cleaned = phone.replace(/\D/g, '');
    
    // Si ya tiene +1, dejarlo como está
    if (cleaned.startsWith('1') && cleaned.length === 11) {
      return `+${cleaned}`;
    }
    
    // Si tiene 10 dígitos, agregar +1
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }
    
    // Si tiene 11 dígitos y empieza con 1, agregar +
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    }

    console.warn('⚠️ Formato de teléfono no soportado:', phone, 'cleaned:', cleaned);
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
    
    // Manejar tanto Date como string para scheduledFor
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