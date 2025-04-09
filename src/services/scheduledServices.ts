import { UserModel } from '../models/User';
import { DealModel } from '../models/Deal';
import { MessageModel } from '../models/Message';
import { sendTemplateMessage } from './whatsappApi';
import * as functions from 'firebase-functions';

const userModel = new UserModel();
const dealModel = new DealModel();
const messageModel = new MessageModel();

/**
 * Weekly scheduled function to send deals to all users
 */
export const scheduleWeeklyDeals = async (context: functions.EventContext): Promise<void> => {
  try {
    console.log('Starting weekly deals notifications');
    
    // 1. Get all active users
    const users = await userModel.getUsersWithAgreementSigned();
    
    // If there are no signed users, exit early
    if (users.length === 0) {
      console.log('No users with signed agreements found');
      return;
    }
    
    // 2. Get all active deals
    const activeDeals = await dealModel.getAllActiveDeals();
    
    // If there are no active deals, exit early
    if (activeDeals.length === 0) {
      console.log('No active deals found');
      return;
    }
    
    // Get up to 3 featured deals to show
    const featuredDeals = activeDeals.slice(0, 3);
    
    // Prepare deals summary text
    let dealsText = '';
    featuredDeals.forEach((deal, index) => {
      dealsText += `${index + 1}. ${deal.title}, ${deal.location.city}\n`;
    });
    
    console.log(`Sending weekly notification to ${users.length} users`);
    
    // 3. For each user, send the weekly deals template message
    for (const user of users) {
      try {
        // Find phone number ID (in production environment, this would be in environment variables)
        // For testing, we'll use a placeholder
        const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
        
        // Use a template message for weekly deals
        // This assumes you've created and approved a template in WhatsApp Business API
        // The template might have parameters like {{1}} for user name, {{2}} for deals count, etc.
        const components = [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: user.fullName || 'חבר יקר' }, // User's name
              { type: 'text', text: `${featuredDeals.length}` },   // Count of deals
              { type: 'text', text: dealsText }                   // Summary of deals
            ]
          }
        ];
        
        // Send template message (assumes template called "weekly_deals" is approved)
        const messageId = await sendTemplateMessage(
          phoneNumberId,
          user.phoneNumber,
          'weekly_deals',
          'he',
          components
        );
        
        // Record this message being sent
        await messageModel.create({
          userId: user.id,
          direction: 'outbound',
          content: `Weekly deals notification: ${dealsText}`,
          type: 'template',
          whatsappMessageId: messageId,
          timestamp: Date.now()
        });
        
        // Update the user's lastDealSent timestamp
        await userModel.update(user.id, {
          lastDealSent: {
            dealId: featuredDeals[0].id, // Record the first deal ID
            timestamp: Date.now()
          }
        });
        
        // Add a delay between messages to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (userError) {
        console.error(`Error sending to user ${user.id}:`, userError);
        // Continue with next user even if one fails
      }
    }
    
    console.log('Weekly deals notifications completed');
  } catch (error) {
    console.error('Error in weekly deals function:', error);
    throw error;
  }
}; 