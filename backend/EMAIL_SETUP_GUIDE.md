# Email Setup Guide for Forgot Password Feature

## Overview
The forgot password feature now uses Nodemailer to send actual emails. Follow this guide to set it up properly.

## Step 1: Install Dependencies
The required `nodemailer` package should already be installed. If not, run:
```bash
cd backend
npm install nodemailer
```

## Step 2: Configure Environment Variables
Create a `.env` file in the backend directory with these variables:

```env
# Database Configuration
DB_HOST=your_database_host
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=your_database_name

# Frontend URL
FRONTEND_URL=http://localhost:8080

# Email Configuration
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

## Step 3: Gmail Setup (Recommended)

### Option A: Using Gmail with App Password (Recommended)
1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Select "Mail" and generate password
   - Use this 16-character password in `EMAIL_PASS`

### Option B: Using Gmail with Less Secure Apps (Not Recommended)
1. Go to Google Account settings
2. Security → Less secure app access → Turn on
3. Use your regular Gmail password in `EMAIL_PASS`

## Step 4: Alternative Email Services

### Using Outlook/Hotmail
```javascript
service: 'hotmail'
// or
host: 'smtp-mail.outlook.com'
port: 587
secure: false
```

### Using Yahoo
```javascript
service: 'yahoo'
// or  
host: 'smtp.mail.yahoo.com'
port: 587
secure: false
```

### Using Custom SMTP
```javascript
host: 'your-smtp-server.com'
port: 587
secure: false // true for 465, false for other ports
auth: {
  user: 'your-email@domain.com',
  pass: 'your-password'
}
```

## Step 5: Testing
1. Start your backend server: `npm run dev`
2. Go to forgot password page
3. Enter a valid email address
4. Check your email inbox (and spam folder)

## Troubleshooting

### Common Issues:

1. **"Invalid login" error**
   - Make sure 2FA is enabled and you're using an app password
   - Check if "Less secure apps" is enabled (if not using app password)

2. **"Connection timeout" error**
   - Check your internet connection
   - Try different SMTP settings
   - Some networks block SMTP ports

3. **Email goes to spam**
   - This is normal for development
   - In production, use services like SendGrid, AWS SES, or Mailgun

4. **"Authentication failed" error**
   - Double-check your email and password
   - Make sure you're using the correct service settings

### Production Recommendations:
- Use professional email services like SendGrid, AWS SES, or Mailgun
- Set up proper SPF, DKIM, and DMARC records
- Use a dedicated sending domain

## Security Notes:
- Never commit your `.env` file to version control
- Use app passwords instead of regular passwords
- Consider using OAuth2 for Gmail in production
- Rotate your email credentials regularly