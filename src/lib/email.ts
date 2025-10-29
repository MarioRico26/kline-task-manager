//kline-task-manager/src/lib/email.ts:
import nodemailer from 'nodemailer';

// DEBUG: Verificar qué variables se están cargando
console.log('🔍 DEBUG - Environment variables:', {
  EMAIL_HOST: process.env.EMAIL_HOST,
  EMAIL_PORT: process.env.EMAIL_PORT,
  EMAIL_USER: process.env.EMAIL_USER ? '✅ SET' : '❌ MISSING',
  EMAIL_PASS: process.env.EMAIL_PASS ? '✅ SET' : '❌ MISSING',
  EMAIL_FROM: process.env.EMAIL_FROM,
  NODE_ENV: process.env.NODE_ENV
});

// Configurar el transporter con tus credenciales SMTP de Gmail
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '465'),
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verificar la configuración al iniciar
transporter.verify(function (error, success) {
  if (error) {
    console.log('❌ Error configurando email:', error);
  } else {
    console.log('✅ Servidor de email listo');
  }
});

interface EmailData {
  to: string;
  subject: string;
  customerName: string;
  service: {
    name: string;
    description?: string | null;
  };
  property: string;
  status: string;
  scheduledFor: string | null;
  notes: string | null;
  images: string[];
}

export async function sendTaskUpdateEmail(emailData: EmailData) {
  try {
    const { to, subject, customerName, service, property, status, scheduledFor, notes, images } = emailData;

    // Preparar thumbnails para el email (máximo 4 imágenes)
    const thumbnails = images.slice(0, 4); // Solo mostrar primeras 4 imágenes
    const hasMoreImages = images.length > 4;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { 
              font-family: 'Arial', sans-serif; 
              line-height: 1.6; 
              color: #333; 
              margin: 0; 
              padding: 0; 
              background: #f5f5f5;
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              background: white;
            }
            .header { 
              background: #e30613; 
              color: white; 
              padding: 30px 20px; 
              text-align: center; 
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
            }
            .content { 
              padding: 30px; 
            }
            .info-box {
              background: #f9f9f9;
              padding: 20px;
              border-radius: 8px;
              border-left: 4px solid #e30613;
              margin: 20px 0;
            }
            .footer { 
              background: #333333; 
              color: white; 
              padding: 20px; 
              text-align: center; 
              font-size: 12px;
            }
            .status-badge {
              display: inline-block;
              padding: 8px 16px;
              border-radius: 20px;
              color: white;
              font-weight: bold;
              background: #e30613;
              font-size: 14px;
            }
            .image-section {
              background: #f8f9fa;
              padding: 15px;
              border-radius: 8px;
              border: 1px solid #e9ecef;
              margin: 15px 0;
            }
            .thumbnail-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 8px;
              margin: 10px 0;
            }
            .thumbnail {
              width: 100%;
              height: 120px;
              object-fit: cover;
              border-radius: 6px;
              border: 1px solid #ddd;
            }
            .image-count {
              background: #e30613;
              color: white;
              padding: 4px 8px;
              border-radius: 10px;
              font-size: 11px;
              font-weight: bold;
            }
            .more-images {
              color: #666;
              font-size: 12px;
              margin-top: 8px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <!-- Header -->
            <div class="header">
              <h1>Kline Brothers - Service Update</h1>
            </div>
            
            <!-- Content -->
            <div class="content">
              <p>Hello <strong>${customerName}</strong>,</p>
              
              <p>We wanted to provide you with an update on your service request:</p>
              
              <div class="info-box">
               <p><strong>Service:</strong> ${service.name}</p>
                ${service.description ? `<p>${service.description}</p>` : ''}
                <p><strong>Property:</strong> ${property}</p>
                <p><strong>Property:</strong> ${service}</p>
                <p><strong>Status:</strong> <span class="status-badge">${status}</span></p>
                ${scheduledFor ? `<p><strong>Scheduled Date:</strong> ${new Date(scheduledFor).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>` : ''}
                ${notes ? `<p><strong>Additional Notes:</strong> ${notes}</p>` : ''}
              </div>

              ${images.length > 0 ? `
                <div class="image-section">
                  <p><strong>📸 Service Photos <span class="image-count">${images.length}</span></strong></p>
                  <div class="thumbnail-grid">
                    ${thumbnails.map(img => `
                      <img class="thumbnail" src="${img}" alt="Service photo" />
                    `).join('')}
                  </div>
                  ${hasMoreImages ? `
                    <p class="more-images">+ ${images.length - 4} more photos available in your account</p>
                  ` : ''}
                  <p style="font-size: 12px; color: #666; margin-top: 8px;">
                    All photos are securely stored with your service record.
                  </p>
                </div>
              ` : ''}

              <p>If you have any questions about this service update, please don't hesitate to reach out to us.</p>
              
              <p>Thank you for choosing Kline!</p>
              
              <p>Best regards,<br><strong>The Kline Brothers Team</strong></p>
            </div>
            
            <!-- Footer -->
            <div class="footer">
              <p>&copy; 2025 Kline Services. All rights reserved.</p>
               <p>This is an automated service notification. Please do not reply to this email.</p>
               <p>Design & Engineering by ByteNetworks • © 2025</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: {
        name: "Kline Service Update",
        address: process.env.EMAIL_FROM as string
      },
      to: to,
      subject: subject,
      html: htmlContent,
      text: `
Service Update: ${service}

Hello ${customerName},

We wanted to update you on your service request:

Service: ${service}
Property: ${property}
Status: ${status}
${scheduledFor ? `Scheduled For: ${new Date(scheduledFor).toLocaleDateString()}` : ''}
${notes ? `Notes: ${notes}` : ''}

${images.length > 0 ? `${images.length} photo(s) have been attached to this task. View them in your account.` : ''}

If you have any questions, please contact us.

Best regards,
The Kline Team
      `.trim()
    };

    console.log('📧 Attempting to send email to:', to);
    console.log('🖼️ Including thumbnails:', thumbnails.length);
    
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully! Message ID:', result.messageId);
    
    return result;

  } catch (error) {
    console.error('❌ Failed to send email:', error);
    // No fallar la aplicación si el email falla
    console.log('⚠️ Continuing without email notification...');
    
    // Manejar el tipo unknown correctamente
    if (error instanceof Error) {
      return { success: false, error: error.message };
    } else {
      return { success: false, error: 'Unknown error occurred' };
    }
  }
}