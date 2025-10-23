import nodemailer from 'nodemailer'

interface EmailData {
  to: string
  subject: string
  customerName: string
  service: string
  property: string
  status: string
  scheduledFor: string | null
  notes: string | null
  images?: string[]
}

// Configuración del transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

// Plantilla de email profesional
export const generateEmailTemplate = (data: EmailData): string => {
  const formattedDate = data.scheduledFor 
    ? new Date(data.scheduledFor).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'Not scheduled'

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Service Update</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f9f9f9;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #e30613, #ffc600);
            padding: 30px;
            text-align: center;
            border-radius: 8px 8px 0 0;
            margin: -20px -20px 30px -20px;
        }
        .header h1 {
            color: white;
            margin: 0;
            font-size: 24px;
            font-weight: bold;
        }
        .content {
            padding: 0 20px 20px 20px;
        }
        .greeting {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 20px;
            color: #1e3a5f;
        }
        .update-section {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            margin-bottom: 20px;
            border-left: 4px solid #e30613;
        }
        .info-item {
            margin-bottom: 10px;
            display: flex;
            align-items: flex-start;
        }
        .info-label {
            font-weight: bold;
            color: #1e3a5f;
            min-width: 120px;
        }
        .info-value {
            color: #333;
            flex: 1;
        }
        .notes {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 6px;
            padding: 15px;
            margin-top: 15px;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            color: #6c757d;
            font-size: 14px;
        }
        .images-section {
            margin-top: 20px;
        }
        .image-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 10px;
            margin-top: 10px;
        }
        .image-item {
            border-radius: 6px;
            overflow: hidden;
            border: 1px solid #e9ecef;
        }
        .image-item img {
            width: 100%;
            height: 120px;
            object-fit: cover;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Kline Brothers</h1>
        </div>
        
        <div class="content">
            <div class="greeting">
                Hello ${data.customerName},
            </div>
            
            <p>This is an update regarding your service request:</p>
            
            <div class="update-section">
                <div class="info-item">
                    <span class="info-label">Service:</span>
                    <span class="info-value">${data.service}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Property:</span>
                    <span class="info-value">${data.property}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Status:</span>
                    <span class="info-value">${data.status}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Scheduled For:</span>
                    <span class="info-value">${formattedDate}</span>
                </div>
            </div>

            ${data.notes ? `
            <div class="notes">
                <strong>Additional Notes:</strong><br>
                ${data.notes}
            </div>
            ` : ''}

            ${data.images && data.images.length > 0 ? `
            <div class="images-section">
                <strong>Attached Images:</strong>
                <div class="image-grid">
                    ${data.images.map(image => `
                        <div class="image-item">
                            <img src="${image}" alt="Service Image">
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            <p>If you have any questions, feel free to contact our office.</p>
            
            <div class="footer">
                <p><strong>Kline Brothers</strong><br>
                609-494-5838<br>
                info@klinebrothers.com</p>
                <p>Monday-Friday: 9am - 5pm</p>
            </div>
        </div>
    </div>
</body>
</html>
  `
}

export const sendTaskUpdateEmail = async (data: EmailData): Promise<boolean> => {
  try {
    const htmlContent = generateEmailTemplate(data)

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: data.to,
      subject: data.subject,
      html: htmlContent,
      attachments: [] as any[]
    }

    // Aquí podríamos agregar attachments si quisiéramos enviar las imágenes como archivos
    // Por ahora las mostramos embebidas en el HTML

    await transporter.sendMail(mailOptions)
    console.log('Email sent successfully to:', data.to)
    return true
  } catch (error) {
    console.error('Error sending email:', error)
    return false
  }
}