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
transporter.verify(function (error) {
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
    notes: string | null
    images: string[]
}

interface CallAssignmentEmailData {
    to: string
    assignedByEmail: string
    assigneeEmail: string
    callerName: string | null
    phoneNumber: string | null
    summary: string
    receivedAt: Date
    callRecordId: string
    isReassignment: boolean
}

interface CallAssignmentDigestEmailData {
    to: string
    assignedByEmail: string
    assigneeEmail: string
    batchLabel: string
    records: Array<{
        callerName: string | null
        phoneNumber: string | null
        summary: string
        receivedAt: Date
        callRecordId: string
    }>
}

function resolveAppBaseUrl() {
    if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
    if (process.env.APP_URL) return process.env.APP_URL
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
    return ''
}

export async function sendTaskUpdateEmail(emailData: EmailData) {
    try {
        const {
            to,
            subject,
            service,
            property,
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
              <p>Hello,</p>
              
              <p>We wanted to provide you with an update on your service request:</p>
              
              <div class="info-box">
                <p><strong>Service:</strong> ${service.name}</p>
                ${service.description ? `<p>${service.description}</p>` : ''}
                <p><strong>Property:</strong> ${property}</p>
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

Hello,

We wanted to update you on your service request:

Service: ${service.name}
Property: ${property}
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

export async function sendCallAssignmentEmail(emailData: CallAssignmentEmailData) {
    try {
        const {
            to,
            assignedByEmail,
            assigneeEmail,
            callerName,
            phoneNumber,
            summary,
            receivedAt,
            callRecordId,
            isReassignment,
        } = emailData

        const appBaseUrl = resolveAppBaseUrl()
        const detailUrl = appBaseUrl ? `${appBaseUrl}/calls-inbox/${callRecordId}` : ''
        const subject = isReassignment ? 'Call record reassigned to you' : 'New call record assigned to you'
        const title = isReassignment ? 'A call record was reassigned to you' : 'A new call record was assigned to you'

        const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              background: #f5f5f5;
              margin: 0;
              padding: 24px 0;
            }
            .container {
              max-width: 640px;
              margin: 0 auto;
              background: #fff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 12px 36px rgba(15, 23, 42, 0.08);
            }
            .header {
              background: #111827;
              color: #fff;
              padding: 24px 28px;
            }
            .content {
              padding: 28px;
            }
            .card {
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              border-left: 4px solid #7c3aed;
              border-radius: 10px;
              padding: 18px 20px;
              margin: 18px 0;
            }
            .cta {
              display: inline-block;
              margin-top: 18px;
              background: #c81e1e;
              color: #fff !important;
              text-decoration: none;
              padding: 12px 18px;
              border-radius: 10px;
              font-weight: bold;
            }
            .meta {
              color: #6b7280;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin:0;font-size:24px;">Kline Calls Inbox</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${assigneeEmail}</strong>,</p>
              <p>${title} by <strong>${assignedByEmail}</strong>.</p>
              <div class="card">
                <p style="margin:0 0 8px;"><strong>Caller:</strong> ${callerName || 'Unknown caller'}</p>
                <p style="margin:0 0 8px;"><strong>Phone:</strong> ${phoneNumber || 'No phone captured'}</p>
                <p style="margin:0 0 8px;"><strong>Received:</strong> ${receivedAt.toLocaleString()}</p>
                <p style="margin:0;"><strong>Summary:</strong> ${summary}</p>
              </div>
              ${
                detailUrl
                    ? `<a class="cta" href="${detailUrl}">Open Call Record</a>`
                    : ''
              }
              <p class="meta" style="margin-top:20px;">This is an internal operational notification from the Kline Task Manager.</p>
            </div>
          </div>
        </body>
      </html>
    `

        await transporter.sendMail({
            from: {
                name: 'Kline Calls Inbox',
                address: from,
            },
            to,
            subject,
            html: htmlContent,
            text: [
                title,
                '',
                `Assigned by: ${assignedByEmail}`,
                `Caller: ${callerName || 'Unknown caller'}`,
                `Phone: ${phoneNumber || 'No phone captured'}`,
                `Received: ${receivedAt.toLocaleString()}`,
                `Summary: ${summary}`,
                detailUrl ? `Open record: ${detailUrl}` : '',
            ]
                .filter(Boolean)
                .join('\n'),
        })

        return { success: true }
    } catch (error) {
        console.error('❌ Failed to send call assignment email:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }
    }
}

export async function sendCallAssignmentDigestEmail(emailData: CallAssignmentDigestEmailData) {
    try {
        const { to, assignedByEmail, assigneeEmail, batchLabel, records } = emailData
        const appBaseUrl = resolveAppBaseUrl()
        const inboxUrl = appBaseUrl ? `${appBaseUrl}/calls-inbox` : ''

        const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              background: #f5f5f5;
              margin: 0;
              padding: 24px 0;
            }
            .container {
              max-width: 700px;
              margin: 0 auto;
              background: #fff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 12px 36px rgba(15, 23, 42, 0.08);
            }
            .header {
              background: #111827;
              color: #fff;
              padding: 24px 28px;
            }
            .content {
              padding: 28px;
            }
            .card {
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 10px;
              padding: 18px 20px;
              margin: 18px 0;
            }
            .record {
              border-top: 1px solid #e5e7eb;
              padding: 14px 0;
            }
            .record:first-child {
              border-top: none;
              padding-top: 0;
            }
            .cta {
              display: inline-block;
              margin-top: 18px;
              background: #c81e1e;
              color: #fff !important;
              text-decoration: none;
              padding: 12px 18px;
              border-radius: 10px;
              font-weight: bold;
            }
            .meta {
              color: #6b7280;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin:0;font-size:24px;">Kline Calls Inbox</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${assigneeEmail}</strong>,</p>
              <p><strong>${assignedByEmail}</strong> promoted ${records.length} voicemail ${records.length === 1 ? 'message' : 'messages'} from <strong>${batchLabel}</strong> into the live inbox for you.</p>
              <div class="card">
                ${records
                    .map(
                        (record) => `
                    <div class="record">
                      <p style="margin:0 0 6px;"><strong>Caller:</strong> ${record.callerName || 'Unknown caller'}</p>
                      <p style="margin:0 0 6px;"><strong>Phone:</strong> ${record.phoneNumber || 'No phone captured'}</p>
                      <p style="margin:0 0 6px;"><strong>Received:</strong> ${record.receivedAt.toLocaleString()}</p>
                      <p style="margin:0;"><strong>Summary:</strong> ${record.summary}</p>
                    </div>
                  `,
                    )
                    .join('')}
              </div>
              ${inboxUrl ? `<a class="cta" href="${inboxUrl}">Open Calls Inbox</a>` : ''}
              <p class="meta" style="margin-top:20px;">This is an internal operational notification from the Kline Task Manager.</p>
            </div>
          </div>
        </body>
      </html>
    `

        await transporter.sendMail({
            from: {
                name: 'Kline Calls Inbox',
                address: from,
            },
            to,
            subject: `Voicemail batch promoted to your Calls Inbox (${records.length})`,
            html: htmlContent,
            text: [
                `Voicemail batch promoted into your Calls Inbox by ${assignedByEmail}.`,
                `Batch: ${batchLabel}`,
                '',
                ...records.flatMap((record, index) => [
                    `${index + 1}. ${record.callerName || 'Unknown caller'} · ${record.phoneNumber || 'No phone captured'}`,
                    `   Received: ${record.receivedAt.toLocaleString()}`,
                    `   Summary: ${record.summary}`,
                ]),
                '',
                inboxUrl ? `Open inbox: ${inboxUrl}` : '',
            ]
                .filter(Boolean)
                .join('\n'),
        })

        return { success: true }
    } catch (error) {
        console.error('❌ Failed to send call assignment digest email:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }
    }
}
