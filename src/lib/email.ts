import nodemailer from 'nodemailer';

// Configurar el transporter con tus credenciales SMTP de Gmail
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '465'),
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Tu app password de Gmail
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
  service: string;
  property: string;
  status: string;
  scheduledFor: string | null;
  notes: string | null;
  images: string[];
}

export async function sendTaskUpdateEmail(emailData: EmailData) {
  try {
    const { to, subject, customerName, service, property, status, scheduledFor, notes, images } = emailData;

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
            .image-notice {
              background: #e8f4fd;
              padding: 15px;
              border-radius: 8px;
              border: 1px solid #b6e0fe;
              margin: 15px 0;
            }
            .button {
              display: inline-block;
              background: #e30613;
              color: white;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              font-weight: bold;
              margin: 10px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <!-- Header -->
            <div class="header">
              <h1>Kline Service Update</h1>
            </div>
            
            <!-- Content -->
            <div class="content">
              <p>Hello <strong>${customerName}</strong>,</p>
              
              <p>We wanted to provide you with an update on your service request:</p>
              
              <div class="info-box">
                <p><strong>Service:</strong> ${service}</p>
                <p><strong>Property:</strong> ${property}</p>
                <p><strong>Status:</strong> <span class="status-badge">${status}</span></p>
                ${scheduledFor ? `<p><strong>Scheduled Date:</strong> ${new Date(scheduledFor).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>` : ''}
                ${notes ? `<p><strong>Additional Notes:</strong> ${notes}</p>` : ''}
              </div>

              ${images.length > 0 ? `
                <div class="image-notice">
                  <p><strong>📸 ${images.length} photo(s) attached</strong></p>
                  <p>Images have been uploaded with your service task. You can view them in your customer portal.</p>
                </div>
              ` : ''}

              <p>If you have any questions about this service update, please don't hesitate to reach out to us.</p>
              
              <p>Thank you for choosing Kline!</p>
              
              <p>Best regards,<br><strong>The Kline Team</strong></p>
            </div>
            
            <!-- Footer -->
            <div class="footer">
              <p>&copy; 2024 Kline Services. All rights reserved.</p>
              <p>This is an automated service notification. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'Kline Services <ricco.mario.nj@gmail.com>',
      to: to,
      subject: subject,
      html: htmlContent,
      // Texto plano alternativo para clientes de email que no soportan HTML
      text: `
Service Update: ${service}

Hello ${customerName},

We wanted to update you on your service request:

Service: ${service}
Property: ${property}
Status: ${status}
${scheduledFor ? `Scheduled For: ${new Date(scheduledFor).toLocaleDateString()}` : ''}
${notes ? `Notes: ${notes}` : ''}

${images.length > 0 ? `${images.length} image(s) have been attached to this task.` : ''}

If you have any questions, please contact us.

Best regards,
The Kline Team
      `.trim()
    };

    console.log('📧 Attempting to send email to:', to);
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully! Message ID:', result.messageId);
    
    return result;

  } catch (error) {
    console.error('❌ Failed to send email:', error);
    throw error;
  }
}