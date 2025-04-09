import { User } from '../models/User';
import { Deal, DealModel } from '../models/Deal';
import { MessageModel } from '../models/Message';
import { AgreementModel } from '../models/Agreement';
import { SubmissionModel } from '../models/Submission';
import { sendTextMessage, sendTemplateMessage, sendInteractiveListMessage } from './whatsappApi';
import { admin } from '../firebase/config/firebase';

const dealModel = new DealModel();
const messageModel = new MessageModel();
const agreementModel = new AgreementModel();
const submissionModel = new SubmissionModel();

/**
 * Processes text messages from users
 */
export async function handleTextMessage(
  user: User,
  messageContent: string,
  phoneNumberId: string
): Promise<void> {
  const content = messageContent.trim().toLowerCase();
  
  // Check if the message is a deal request (just a number)
  if (/^\d+$/.test(content)) {
    await handleDealRequest(user, parseInt(content, 10), phoneNumberId);
    return;
  }
  
  // Check for specific commands
  switch(content) {
    case 'חתום':
    case 'לחתום':
    case 'sign':
    case 'signature':
      await handleSignatureRequest(user, phoneNumberId);
      return;
      
    case 'עסקאות':
    case 'deals':
      await handleDealsListRequest(user, phoneNumberId);
      return;
      
    case 'אנונימי':
    case 'עסקה אנונימית':
    case 'anonymous':
    case 'submit deal':
      await handleAnonymousDealRequest(user, phoneNumberId);
      return;
      
    case 'עזרה':
    case 'help':
      await handleHelpRequest(user, phoneNumberId);
      return;
      
    default:
      // For any other message, send a generic response
      await handleGenericMessage(user, content, phoneNumberId);
      return;
  }
}

/**
 * Handle a request for a specific deal by number (e.g., "1", "2")
 */
async function handleDealRequest(
  user: User,
  dealNumber: number,
  phoneNumberId: string
): Promise<void> {
  try {
    // Get the most recent deals for this user
    const activeDeals = await dealModel.getAllActiveDeals();
    
    // Make sure the number is valid
    if (dealNumber < 1 || dealNumber > activeDeals.length) {
      await sendTextMessage(phoneNumberId, user.phoneNumber, 
        'מספר העסקה אינו תקין. נא לבחור מספר מרשימת העסקאות.');
      return;
    }
    
    // Get the requested deal (adjust for 0-based index)
    const requestedDeal = activeDeals[dealNumber - 1];
    
    // Add this user to the visibleTo list for the deal
    await dealModel.addUserVisibility(requestedDeal.id, user.id);
    
    // Check if user has signed agreement
    const hasSigned = user.agreementSigned || 
      await agreementModel.hasUserSignedAgreement(user.id, 'brokerage');
    
    if (hasSigned) {
      // If signed, show full details
      await sendFullDealDetails(user, requestedDeal, phoneNumberId);
    } else {
      // If not signed, show limited details and prompt for signature
      await sendLimitedDealDetails(user, requestedDeal, phoneNumberId);
    }
  } catch (error) {
    console.error('Error handling deal request:', error);
    await sendTextMessage(phoneNumberId, user.phoneNumber, 
      'אירעה שגיאה בעת טיפול בבקשתך. אנא נסה שנית מאוחר יותר.');
  }
}

/**
 * Send full deal details to a user
 */
async function sendFullDealDetails(
  user: User,
  deal: Deal,
  phoneNumberId: string
): Promise<void> {
  // Format the full details message
  let message = `*${deal.title}*\n\n`;
  message += `📍 מיקום: ${deal.location.city}`;
  
  if (deal.location.area) {
    message += `, ${deal.location.area}`;
  }
  
  if (deal.location.address) {
    message += `\n🏢 כתובת: ${deal.location.address}`;
  }
  
  message += `\n🏢 סוג הנכס: ${deal.propertyType}`;
  
  if (deal.size) {
    message += `\n📏 שטח: ${deal.size} מ"ר`;
  }
  
  // Price information
  if (deal.price) {
    if (deal.price.amount) {
      message += `\n💰 מחיר: ${deal.price.amount.toLocaleString()} ${deal.price.currency}`;
    } else if (deal.price.range) {
      message += `\n💰 טווח מחירים: ${deal.price.range.min.toLocaleString()} - ${deal.price.range.max.toLocaleString()} ${deal.price.currency}`;
    }
  }
  
  // Full details if available
  if (deal.fullDetails) {
    message += `\n\n📝 פרטים נוספים:\n${deal.fullDetails}`;
  }
  
  // Contact information
  message += '\n\nלקבלת מידע נוסף, צור קשר עם המתווך.';
  
  await sendTextMessage(phoneNumberId, user.phoneNumber, message);
  
  // Record this message
  await messageModel.create({
    userId: user.id,
    direction: 'outbound',
    content: message,
    type: 'text',
    dealId: deal.id,
    timestamp: Date.now()
  });
}

/**
 * Send limited deal details to a user who hasn't signed an agreement
 */
async function sendLimitedDealDetails(
  user: User,
  deal: Deal,
  phoneNumberId: string
): Promise<void> {
  // Format the limited details message
  let message = `*${deal.title}*\n\n`;
  message += `📍 אזור: ${deal.location.city}`;
  
  if (deal.location.area) {
    message += `, ${deal.location.area}`;
  }
  
  message += `\n🏢 סוג הנכס: ${deal.propertyType}`;
  
  if (deal.size) {
    message += `\n📏 שטח: ${deal.size} מ"ר`;
  }
  
  // Limited price information (maybe just a range or no exact amount)
  if (deal.price && deal.price.range) {
    message += `\n💰 טווח מחירים: ${deal.price.range.min.toLocaleString()} - ${deal.price.range.max.toLocaleString()} ${deal.price.currency}`;
  }
  
  // Prompt to sign agreement
  message += '\n\n⚠️ לקבלת פרטים מלאים (כתובת מדויקת, תמונות, ופרטי קשר), יש לחתום על הסכם התיווך הדיגיטלי.';
  message += '\n\nלחתימה דיגיטלית, הקלד/י "חתום".';
  
  await sendTextMessage(phoneNumberId, user.phoneNumber, message);
  
  // Record this message
  await messageModel.create({
    userId: user.id,
    direction: 'outbound',
    content: message,
    type: 'text',
    dealId: deal.id,
    timestamp: Date.now()
  });
}

/**
 * Handle signature request from user
 */
async function handleSignatureRequest(
  user: User,
  phoneNumberId: string
): Promise<void> {
  try {
    // Check if user already has a pending signature request
    const userAgreements = await agreementModel.getUserAgreements(user.id);
    const pendingAgreement = userAgreements.find(a => a.status === 'pending' && a.type === 'brokerage');
    
    if (pendingAgreement) {
      // If there's already a pending agreement, remind the user
      await sendTextMessage(phoneNumberId, user.phoneNumber,
        'יש לך כבר בקשת חתימה בהמתנה. בדוק/י את הדואר האלקטרוני שלך לקבלת קישור לחתימה, או עדכן/י אותנו בכתובת דוא"ל חדשה.');
    } else {
      // Check if the user has an email address
      if (!user.email) {
        // If no email, ask the user to provide one
        await sendTextMessage(phoneNumberId, user.phoneNumber,
          'לחתימה דיגיטלית, אנחנו צריכים את כתובת הדואר האלקטרוני שלך. נא לשלוח את כתובת האימייל.');
        
        // TODO: Update conversation state to await email
        // This would be handled in a more complex state management system
      } else {
        // We have the email, so we can initiate the signature process
        // This is a placeholder - in a real implementation, we would call the DocuSign service
        await sendTextMessage(phoneNumberId, user.phoneNumber,
          `נשלח אליך קישור לחתימה דיגיטלית לכתובת ${user.email}. לאחר השלמת החתימה, תוכל/י לקבל את מלוא פרטי העסקאות.`);
        
        // TODO: Call a service to create a DocuSign envelope and send it
        // For now, we'll just log that we would do this
        console.log(`Would send DocuSign request to user ${user.id} at email ${user.email}`);
      }
    }
  } catch (error) {
    console.error('Error handling signature request:', error);
    await sendTextMessage(phoneNumberId, user.phoneNumber,
      'אירעה שגיאה בעת טיפול בבקשת החתימה. אנא נסה שנית מאוחר יותר.');
  }
}

/**
 * Handle a request to see all available deals
 */
async function handleDealsListRequest(
  user: User,
  phoneNumberId: string
): Promise<void> {
  try {
    // Get active deals
    const activeDeals = await dealModel.getAllActiveDeals();
    
    if (activeDeals.length === 0) {
      await sendTextMessage(phoneNumberId, user.phoneNumber,
        'אין עסקאות פעילות זמינות כרגע. אנא בדוק שוב מאוחר יותר.');
      return;
    }
    
    // Prepare the list message
    const sections = [{
      title: 'עסקאות זמינות',
      rows: activeDeals.slice(0, 10).map((deal, index) => ({
        id: `deal_${deal.id}`,
        title: `${index + 1}. ${deal.title}`,
        description: `${deal.location.city}, ${deal.propertyType}`
      }))
    }];
    
    // Send as an interactive list
    await sendInteractiveListMessage(
      phoneNumberId,
      user.phoneNumber,
      'עסקאות נדל"ן זמינות',
      'בחר/י עסקה לצפייה בפרטים נוספים',
      sections,
      'רשימת העסקאות'
    );
    
    // Also send a text instruction
    await sendTextMessage(phoneNumberId, user.phoneNumber,
      'ניתן גם להשיב עם המספר של העסקה המבוקשת (לדוגמה: "1" לעסקה הראשונה)');
    
  } catch (error) {
    console.error('Error handling deals list request:', error);
    await sendTextMessage(phoneNumberId, user.phoneNumber,
      'אירעה שגיאה בעת טיפול בבקשתך. אנא נסה שנית מאוחר יותר.');
  }
}

/**
 * Handle request to submit an anonymous deal
 */
async function handleAnonymousDealRequest(
  user: User,
  phoneNumberId: string
): Promise<void> {
  // Start the conversation flow for submitting a deal
  await sendTextMessage(phoneNumberId, user.phoneNumber,
    'תודה על התעניינותך בהעלאת עסקה אנונימית. אנא מלא/י את הפרטים הבאים:\n\n'
    + '1. סוג הנכס (משרדים, מסחרי, מגורים, וכו\')\n'
    + '2. מיקום (עיר/אזור)\n'
    + '3. שטח (במ"ר)\n'
    + '4. טווח מחיר (אופציונלי)\n'
    + '5. תיאור קצר של הנכס\n\n'
    + 'אנא שלח/י את כל המידע בהודעה אחת.');
  
  // TODO: Implement a more interactive state-based flow
  // For now, we'll rely on the user to send all info in one message
  
  // Record in the database that we're awaiting submission
  // In a real implementation, you would update a conversation state tracker
  console.log(`User ${user.id} was prompted to submit an anonymous deal`);
}

/**
 * Handle a help request
 */
async function handleHelpRequest(
  user: User,
  phoneNumberId: string
): Promise<void> {
  const helpMessage = 'ברוכים הבאים למערכת הבוט לניהול עסקאות נדל"ן!\n\n'
    + 'פקודות זמינות:\n'
    + '• "עסקאות" - הצגת רשימת העסקאות הזמינות\n'
    + '• מספר (למשל "1") - צפייה בפרטי עסקה ספציפית\n'
    + '• "חתום" - לחתימה על הסכם תיווך דיגיטלי\n'
    + '• "אנונימי" - העלאת עסקה אנונימית למערכת\n'
    + '• "עזרה" - הצגת הודעה זו\n\n'
    + 'לשאלות נוספות, אנא פנה למתווך שלך.';
  
  await sendTextMessage(phoneNumberId, user.phoneNumber, helpMessage);
}

/**
 * Handle generic messages that don't match specific commands
 */
async function handleGenericMessage(
  user: User,
  content: string,
  phoneNumberId: string
): Promise<void> {
  // If it looks like an email address, maybe the user is responding to our email request
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content)) {
    // Update the user's email
    await admin.firestore().collection('users').doc(user.id).update({
      email: content,
      updatedAt: Date.now()
    });
    
    await sendTextMessage(phoneNumberId, user.phoneNumber,
      `תודה! כתובת האימייל ${content} נשמרה במערכת. להמשך תהליך החתימה, אנא הקלד "חתום" שוב.`);
    return;
  }
  
  // For long messages, it might be an anonymous deal submission
  if (content.length > 50) {
    // Create a submission record
    await submissionModel.create({
      submittedBy: user.id,
      description: content,
    });
    
    await sendTextMessage(phoneNumberId, user.phoneNumber,
      'תודה על שליחת המידע. המתווך יבחן את הפרטים בהקדם וייצור קשר במידת הצורך.');
    
    // TODO: Send notification to the agent about the new submission
    return;
  }
  
  // Default generic response
  await sendTextMessage(phoneNumberId, user.phoneNumber,
    'תודה על פנייתך. אם ברצונך לראות את העסקאות הזמינות, הקלד "עסקאות". לעזרה, הקלד "עזרה".');
} 