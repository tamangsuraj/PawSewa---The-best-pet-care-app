const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Generate a 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send OTP email with premium design
 */
const sendOTPEmail = async (email, name, otp) => {
  const mailOptions = {
    from: `"PawSewa" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '🐾 Verify Your PawSewa Account',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>Verify Your PawSewa Account</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #fdf8f5; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
        
        <!-- Email Container -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fdf8f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              
              <!-- Main Card -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 24px rgba(112, 52, 24, 0.12); overflow: hidden;">
                
                <!-- Header with Logo -->
                <tr>
                  <td style="background-color: #703418; padding: 40px 30px; text-align: center;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td align="center">
                          <!-- Logo Placeholder -->
                          <div style="width: 80px; height: 80px; background-color: rgba(255, 255, 255, 0.15); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px; border: 3px solid rgba(255, 255, 255, 0.3);">
                            <span style="font-size: 40px; line-height: 1;">🐾</span>
                          </div>
                          <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">PawSewa</h1>
                          <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px; font-weight: 500;">Your Pet Care Partner</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Content Body -->
                <tr>
                  <td style="padding: 48px 40px;">
                    
                    <!-- Greeting -->
                    <h2 style="margin: 0 0 24px 0; color: #1a1a1a; font-size: 24px; font-weight: 600; line-height: 1.3;">
                      Hello ${name}! 👋
                    </h2>
                    
                    <!-- Message -->
                    <p style="margin: 0 0 32px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                      Thank you for joining the PawSewa family! We're excited to have you on board. To complete your registration and secure your account, please verify your email address using the code below.
                    </p>
                    
                    <!-- OTP Box -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 32px 0;">
                      <tr>
                        <td align="center">
                          <div style="background: linear-gradient(135deg, #fdf8f5 0%, #f5ebe0 100%); border: 2px dashed #703418; border-radius: 12px; padding: 32px 24px; text-align: center;">
                            <p style="margin: 0 0 12px 0; color: #703418; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                              Your Verification Code
                            </p>
                            <div style="font-size: 48px; font-weight: 700; color: #703418; letter-spacing: 10px; font-family: 'Courier New', monospace; margin: 8px 0;">
                              ${otp}
                            </div>
                            <p style="margin: 12px 0 0 0; color: #8b6f47; font-size: 13px;">
                              ⏱️ Expires in 10 minutes
                            </p>
                          </div>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- CTA Button -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 32px 0;">
                      <tr>
                        <td align="center">
                          <a href="#" style="display: inline-block; background-color: #703418; color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(112, 52, 24, 0.25); transition: all 0.3s ease;">
                            Verify Now →
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Instructions -->
                    <div style="background-color: #f8f9fa; border-left: 4px solid #703418; border-radius: 8px; padding: 20px 24px; margin: 0 0 32px 0;">
                      <p style="margin: 0 0 12px 0; color: #1a1a1a; font-size: 15px; font-weight: 600;">
                        📋 What to do next:
                      </p>
                      <ol style="margin: 0; padding-left: 20px; color: #4a4a4a; font-size: 14px; line-height: 1.8;">
                        <li>Copy the 6-digit code above</li>
                        <li>Return to the PawSewa verification page</li>
                        <li>Enter the code to activate your account</li>
                      </ol>
                    </div>
                    
                    <!-- Security Notice -->
                    <div style="background: linear-gradient(135deg, #fff3cd 0%, #ffe8a1 100%); border-radius: 8px; padding: 20px 24px; margin: 0;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr>
                          <td width="40" valign="top">
                            <div style="width: 32px; height: 32px; background-color: #ffc107; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px;">
                              🔒
                            </div>
                          </td>
                          <td valign="top">
                            <p style="margin: 0 0 8px 0; color: #856404; font-size: 14px; font-weight: 600;">
                              Security Notice
                            </p>
                            <p style="margin: 0; color: #856404; font-size: 13px; line-height: 1.6;">
                              Never share this code with anyone. PawSewa staff will never ask for your verification code via phone, email, or any other method.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </div>
                    
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f9fa; padding: 32px 40px; border-top: 1px solid #e9ecef;">
                    
                    <!-- Company Info -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td align="center">
                          <p style="margin: 0 0 8px 0; color: #6c757d; font-size: 13px; line-height: 1.6;">
                            <strong>PawSewa Pet Care Services</strong><br>
                            Kathmandu, Nepal<br>
                            Email: support@pawsewa.com
                          </p>
                          <p style="margin: 16px 0 8px 0; color: #adb5bd; font-size: 12px; line-height: 1.6;">
                            You received this email because you registered for a PawSewa account.<br>
                            If you didn't request this, please ignore this email.
                          </p>
                          <p style="margin: 16px 0 0 0; color: #adb5bd; font-size: 11px;">
                            © 2026 PawSewa. All rights reserved.
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                  </td>
                </tr>
                
              </table>
              
            </td>
          </tr>
        </table>
        
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ OTP email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending OTP email:', error);
    throw new Error('Failed to send verification email');
  }
};

/**
 * Send welcome email (for admin-created users) with premium design
 */
const sendWelcomeEmail = async (email, name, role, tempPassword) => {
  const roleNames = {
    pet_owner: 'Pet Owner',
    veterinarian: 'Veterinarian',
    admin: 'Administrator',
    shop_owner: 'Shop Owner',
    care_service: 'Care Service Provider',
    rider: 'Delivery Rider',
  };

  const roleEmojis = {
    pet_owner: '🐕',
    veterinarian: '⚕️',
    admin: '👑',
    shop_owner: '🏪',
    care_service: '🏠',
    rider: '🏍️',
  };

  const mailOptions = {
    from: `"PawSewa" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `${roleEmojis[role]} Welcome to PawSewa - Your ${roleNames[role]} Account`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>Welcome to PawSewa</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #fdf8f5; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
        
        <!-- Email Container -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fdf8f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              
              <!-- Main Card -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 24px rgba(112, 52, 24, 0.12); overflow: hidden;">
                
                <!-- Header with Logo -->
                <tr>
                  <td style="background-color: #703418; padding: 40px 30px; text-align: center;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td align="center">
                          <!-- Logo Placeholder -->
                          <div style="width: 80px; height: 80px; background-color: rgba(255, 255, 255, 0.15); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px; border: 3px solid rgba(255, 255, 255, 0.3);">
                            <span style="font-size: 40px; line-height: 1;">🐾</span>
                          </div>
                          <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">PawSewa</h1>
                          <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px; font-weight: 500;">Your Pet Care Partner</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Content Body -->
                <tr>
                  <td style="padding: 48px 40px;">
                    
                    <!-- Greeting with Role Badge -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 24px 0;">
                      <tr>
                        <td>
                          <h2 style="margin: 0 0 12px 0; color: #1a1a1a; font-size: 28px; font-weight: 600; line-height: 1.3;">
                            Welcome to PawSewa, ${name}! 🎉
                          </h2>
                          <div style="display: inline-block; background: linear-gradient(135deg, #703418 0%, #8b6f47 100%); color: #ffffff; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600;">
                            ${roleEmojis[role]} ${roleNames[role]}
                          </div>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Message -->
                    <p style="margin: 0 0 32px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                      Your account has been created by the PawSewa administrator. We're excited to have you as part of our team! Below are your login credentials to get started.
                    </p>
                    
                    <!-- Credentials Box -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 32px 0;">
                      <tr>
                        <td>
                          <div style="background: linear-gradient(135deg, #fdf8f5 0%, #f5ebe0 100%); border: 2px solid #703418; border-radius: 12px; padding: 24px; overflow: hidden;">
                            
                            <p style="margin: 0 0 20px 0; color: #703418; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                              🔑 Your Login Credentials
                            </p>
                            
                            <!-- Email Row -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 16px 0;">
                              <tr>
                                <td style="padding: 12px 0; border-bottom: 1px solid rgba(112, 52, 24, 0.1);">
                                  <p style="margin: 0 0 4px 0; color: #8b6f47; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Email Address</p>
                                  <p style="margin: 0; color: #703418; font-size: 15px; font-weight: 600; font-family: 'Courier New', monospace;">${email}</p>
                                </td>
                              </tr>
                            </table>
                            
                            <!-- Password Row -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 16px 0;">
                              <tr>
                                <td style="padding: 12px 0; border-bottom: 1px solid rgba(112, 52, 24, 0.1);">
                                  <p style="margin: 0 0 4px 0; color: #8b6f47; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Temporary Password</p>
                                  <p style="margin: 0; color: #703418; font-size: 18px; font-weight: 700; font-family: 'Courier New', monospace; letter-spacing: 2px;">${tempPassword}</p>
                                </td>
                              </tr>
                            </table>
                            
                            <!-- Role Row -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                              <tr>
                                <td style="padding: 12px 0;">
                                  <p style="margin: 0 0 4px 0; color: #8b6f47; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Account Type</p>
                                  <p style="margin: 0; color: #703418; font-size: 15px; font-weight: 600;">${roleEmojis[role]} ${roleNames[role]}</p>
                                </td>
                              </tr>
                            </table>
                            
                          </div>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- CTA Button -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 32px 0;">
                      <tr>
                        <td align="center">
                          <a href="#" style="display: inline-block; background-color: #703418; color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(112, 52, 24, 0.25);">
                            Login to Your Account →
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Next Steps -->
                    <div style="background-color: #f8f9fa; border-left: 4px solid #703418; border-radius: 8px; padding: 20px 24px; margin: 0 0 32px 0;">
                      <p style="margin: 0 0 12px 0; color: #1a1a1a; font-size: 15px; font-weight: 600;">
                        📋 Next Steps:
                      </p>
                      <ol style="margin: 0; padding-left: 20px; color: #4a4a4a; font-size: 14px; line-height: 1.8;">
                        <li>Log in using the credentials above</li>
                        <li>Change your password immediately</li>
                        <li>Complete your profile information</li>
                        <li>Explore your dashboard and features</li>
                      </ol>
                    </div>
                    
                    <!-- Security Notice -->
                    <div style="background: linear-gradient(135deg, #fff3cd 0%, #ffe8a1 100%); border-radius: 8px; padding: 20px 24px; margin: 0;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr>
                          <td width="40" valign="top">
                            <div style="width: 32px; height: 32px; background-color: #ffc107; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px;">
                              🔒
                            </div>
                          </td>
                          <td valign="top">
                            <p style="margin: 0 0 8px 0; color: #856404; font-size: 14px; font-weight: 600;">
                              Security Reminder
                            </p>
                            <p style="margin: 0; color: #856404; font-size: 13px; line-height: 1.6;">
                              Your account is already verified and ready to use. Please keep your credentials secure and never share them with anyone. Change your temporary password after your first login.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </div>
                    
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f9fa; padding: 32px 40px; border-top: 1px solid #e9ecef;">
                    
                    <!-- Company Info -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td align="center">
                          <p style="margin: 0 0 8px 0; color: #6c757d; font-size: 13px; line-height: 1.6;">
                            <strong>PawSewa Pet Care Services</strong><br>
                            Kathmandu, Nepal<br>
                            Email: support@pawsewa.com
                          </p>
                          <p style="margin: 16px 0 8px 0; color: #adb5bd; font-size: 12px; line-height: 1.6;">
                            You received this email because an administrator created an account for you.<br>
                            If you believe this is a mistake, please contact support immediately.
                          </p>
                          <p style="margin: 16px 0 0 0; color: #adb5bd; font-size: 11px;">
                            © 2026 PawSewa. All rights reserved.
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                  </td>
                </tr>
                
              </table>
              
            </td>
          </tr>
        </table>
        
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Welcome email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
    // Don't throw error - account creation should succeed even if email fails
    return false;
  }
};

module.exports = {
  generateOTP,
  sendOTPEmail,
  sendWelcomeEmail,
};
