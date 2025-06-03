# 🔥 Firebase SMS Authentication Setup Guide

## Step 1: Enable Phone Authentication in Firebase Console

1. **Go to Firebase Console**
   - Visit [https://console.firebase.google.com/](https://console.firebase.google.com/)
   - Select your "vault-love-7c7ff" project

2. **Navigate to Authentication**
   - In the left sidebar, click on "Authentication"
   - Go to the "Sign-in method" tab

3. **Enable Phone Authentication**
   - Find "Phone" in the list of sign-in providers
   - Click on "Phone" and toggle it to "Enabled"
   - Click "Save"

## Step 2: Set Up Phone Numbers for Testing (Optional)

1. **Add Test Phone Numbers** (for development)
   - In the Authentication > Sign-in method page
   - Scroll down to "Phone numbers for testing"
   - Add test phone numbers with custom verification codes
   - Example: `+1 650-555-3434` with code `123456`

## Step 3: Configure reCAPTCHA (Web Only)

1. **Get reCAPTCHA Site Key**
   - Go to [Google reCAPTCHA](https://www.google.com/recaptcha/admin)
   - Create a new site or use existing
   - Choose reCAPTCHA v2 ("I'm not a robot" checkbox)
   - Add your domain (localhost for testing)
   - Copy the Site Key

2. **Add to Firebase**
   - In Firebase Console > Authentication > Sign-in method
   - Scroll to "Advanced" section
   - Add your reCAPTCHA site key

## Step 4: Set Up SMS Provider (Production)

For production use, you need to configure an SMS provider:

### Option A: Firebase Cloud Messaging (Recommended)
1. **Enable Cloud Messaging API**
   - Go to Google Cloud Console
   - Select your project
   - Enable "Cloud Messaging API"

### Option B: Third-party SMS Provider
1. **Twilio Setup** (if you prefer Twilio)
   - Create Twilio account
   - Get Account SID and Auth Token
   - Configure in Firebase Functions

## Step 5: Update Security Rules

1. **Firestore Security Rules**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow phone-authenticated users
    match /media/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Step 6: Add Required Permissions (Mobile)

### Android (android/app/src/main/AndroidManifest.xml)
```xml
<uses-permission android:name="android.permission.READ_PHONE_STATE" />
<uses-permission android:name="android.permission.READ_CONTACTS" />
<uses-permission android:name="android.permission.RECEIVE_SMS" />
<uses-permission android:name="android.permission.READ_SMS" />
```

### iOS (ios/Runner/Info.plist)
```xml
<key>NSContactsUsageDescription</key>
<string>This app needs access to contacts to auto-detect your phone number</string>
```

## Step 7: Configure App for Production

1. **Add SHA-256 Fingerprints** (Android)
   ```bash
   # Get debug fingerprint
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
   
   # Get release fingerprint
   keytool -list -v -keystore your-release-key.keystore -alias your-key-alias
   ```
   
   - Copy SHA-256 fingerprints
   - Add to Firebase Console > Project Settings > Your apps > Android app

2. **Add Bundle ID** (iOS)
   - Ensure iOS Bundle ID matches in Firebase Console

## Step 8: Test the Implementation

1. **Test with Real Phone Number**
   ```javascript
   // Use your real phone number for testing
   const phoneNumber = "+1234567890";
   ```

2. **Verify OTP Reception**
   - Make sure you receive SMS on your device
   - Test the 6-digit code verification

## Step 9: Monitoring and Quotas

1. **Check Usage Quotas**
   - Firebase Console > Authentication > Usage
   - Monitor SMS costs and limits

2. **Set Up Billing Alerts**
   - Google Cloud Console > Billing
   - Set up budget alerts for SMS costs

## Step 10: Production Checklist

- [ ] Remove test phone numbers
- [ ] Add real reCAPTCHA keys
- [ ] Configure proper SMS provider
- [ ] Add production app fingerprints
- [ ] Set up monitoring and alerts
- [ ] Test with real devices
- [ ] Configure proper security rules

## Troubleshooting Common Issues

### Issue: "quota-exceeded" Error
**Solution:** 
- Check Firebase pricing plan
- Verify SMS quota limits
- Upgrade to paid plan if needed

### Issue: reCAPTCHA Not Working
**Solution:**
- Verify site key is correct
- Check domain configuration
- Ensure reCAPTCHA v2 is used

### Issue: SMS Not Received
**Solution:**
- Check phone number format (+country code)
- Verify SMS provider configuration
- Check spam folder
- Test with different phone number

### Issue: "invalid-phone-number" Error
**Solution:**
- Ensure international format (+1234567890)
- Remove spaces and special characters
- Verify country code is correct

## Security Best Practices

1. **Rate Limiting**
   - Implement client-side rate limiting
   - Use Firebase Security Rules for server-side protection

2. **Phone Number Validation**
   - Validate format before sending OTP
   - Implement proper error handling

3. **OTP Security**
   - Use 6-digit codes
   - Set expiration time (5-10 minutes)
   - Limit verification attempts

4. **User Privacy**
   - Don't store phone numbers unnecessarily
   - Follow GDPR/privacy regulations
   - Secure data transmission

## Cost Estimation

- **Free Tier:** Limited SMS verifications per month
- **Paid Tier:** ~$0.01-0.05 per SMS (varies by region)
- **Monthly Estimate:** For 1000 users ≈ $10-50/month

## Support Resources

- [Firebase Phone Auth Documentation](https://firebase.google.com/docs/auth/web/phone-auth)
- [Firebase Support](https://firebase.google.com/support/)
- [Google Cloud Support](https://cloud.google.com/support/)

---

**⚠️ Important Notes:**
- Test thoroughly before production
- Monitor costs and usage
- Keep security rules updated
- Regular security audits 