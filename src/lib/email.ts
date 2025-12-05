// kline-task-manager/src/lib/email.ts
import nodemailer from 'nodemailer'

// DEBUG: Verificar qué variables se están cargando
const host = process.env.EMAIL_HOST || 'smtp.office365.com'
const port = parseInt(process.env.EMAIL_PORT || '587', 10)
const user = process.env.EMAIL_USER
const pass = process.env.EMAIL_PASS
const from = process.env.EMAIL_FROM || user || ''

console.log('🔍 DEBUG - Environment variables:', {
    EMAIL_HOST: host,
    EMAIL_PORT: port,
    EMAIL_USER: user ? '✅ SET' : '❌ MISSING',
    EMAIL_PASS: pass ? '✅ SET' : '❌ MISSING',
    EMAIL_FROM: from,
    NODE_ENV: process.env.NODE_ENV,
})

// Transporter para Office 365 (STARTTLS en 587)
const transporter = nodemailer.createTransport({
    host,
    port,
    secure: false, // 🔴 IMPORTANTE: false para 587 (STARTTLS)
    auth: {
        user,
        pass,
    },
    tls: {
        minVersion: 'TLSv1.2',
    },
})

// Verificar la configuración al iniciar
transporter.verify(function (error, success) {
    if (error) {
        console.log('❌ Error configurando email:', error)
    } else {
        console.log('✅ Servidor de email listo')
    }
})

interface EmailData {
    to: string
    subject: string
    customerName: string
    service: {
        name: string
        description?: string | null
    }
    property: string
    status: string
    scheduledFor: string | null
    notes: string | null
    images: string[]
}

export async function sendTaskUpdateEmail(emailData: EmailData) {
    try {
        const {
            to,
            subject,
            customerName,
            service,
            property,
            status,
            scheduledFor,
            notes,
            images,
        } = emailData

        // Preparar thumbnails para el email (máximo 4 imágenes)
        const thumbnails = images.slice(0, 4)
        const hasMoreImages = images.length > 4

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
                <p><strong>Status:</strong> <span class="status-badge">${status}</span></p>
                ${
            scheduledFor
                ? `<p><strong>Scheduled Date:</strong> ${new Date(
                    scheduledFor,
                ).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })}</p>`
                : ''
        }
                ${notes ? `<p><strong>Additional Notes:</strong> ${notes}</p>` : ''}
              </div>

              ${
            images.length > 0
                ? `
                <div class="image-section">
                  <p><strong>📸 Service Photos <span class="image-count">${images.length}</span></strong></p>
                  <div class="thumbnail-grid">
                    ${thumbnails
                    .map(
                        (img) => `
                      <img class="thumbnail" src="${img.trim()}" alt="Service photo" style="display:block; max-width:100%; border-radius:6px;" />
                    `,
                    )
                    .join('')}
                  </div>
                  ${
                    hasMoreImages
                        ? `
                    <p class="more-images">+ ${
                            images.length - 4
                        } more photos available in your account</p>
                  `
                        : ''
                }
                  <p style="font-size: 12px; color: #666; margin-top: 8px;">
                    All photos are securely stored with your service record.
                  </p>
                </div>
              `
                : ''
        }

              <p>Please call 609-494-5838 with any questions. We look forward to working with you in the future. </p>
              
              <p>Thank you, Kline Bros. Landscaping & Pool Company.</p>
              
              <p><strong>Disclaimer: This email is not monitored, and any replies will not be answered.</strong></p>
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
    `

        const mailOptions = {
            from: {
                name: 'Kline Service Update',
                address: from,
            },
            to,
            subject,
            html: htmlContent,
            text: `
Service Update: ${service.name}

Hello ${customerName},

We wanted to update you on your service request:

Service: ${service.name}
Property: ${property}
Status: ${status}
${scheduledFor ? `Scheduled For: ${new Date(scheduledFor).toLocaleDateString()}` : ''}
${notes ? `Notes: ${notes}` : ''}

${
                images.length > 0
                    ? `${images.length} photo(s) have been attached to this task. View them in your account.`
                    : ''
            }

If you have any questions, please contact us.

Best regards,
The Kline Team
      `.trim(),
        }

        console.log('📧 Attempting to send email to:', to)
        console.log('🖼️ Including thumbnails:', thumbnails.length)
        console.log('📨 SMTP config in use:', { host, port, secure: false, from })

        const result = await transporter.sendMail(mailOptions)
        console.log('✅ Email sent successfully! Message ID:', result.messageId)

        return result
    } catch (error) {
        console.error('❌ Failed to send email:', error)
        console.log('⚠️ Continuing without email notification...')

        if (error instanceof Error) {
            return { success: false, error: error.message }
        } else {
            return { success: false, error: 'Unknown error occurred' }
        }
    }
}
