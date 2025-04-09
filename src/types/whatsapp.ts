export type MessageType = 'text' | 'image' | 'document' | 'audio' | 'video' | 'interactive';

export interface WebhookRequestBody {
  object: string;
  entry: {
    id: string;
    changes: {
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: {
          profile: {
            name: string;
          };
          wa_id: string;
        }[];
        messages?: WebhookMessageReceived[];
        statuses?: WebhookMessageStatus[];
      };
      field: string;
    }[];
  }[];
}

export interface WebhookMessageReceived {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: {
    body: string;
  };
  image?: {
    caption?: string;
    id: string;
    mime_type: string;
    sha256: string;
  };
  audio?: {
    id: string;
    mime_type: string;
    sha256: string;
  };
  video?: {
    caption?: string;
    id: string;
    mime_type: string;
    sha256: string;
  };
  document?: {
    caption?: string;
    filename: string;
    id: string;
    mime_type: string;
    sha256: string;
  };
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: {
      id: string;
      title: string;
    };
    list_reply?: {
      id: string;
      title: string;
      description?: string;
    };
  };
  context?: {
    from: string;
    id: string;
  };
}

export interface WebhookMessageStatus {
  id: string;
  recipient_id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  conversation: {
    id: string;
    origin: {
      type: string;
    };
  };
  pricing: {
    billable: boolean;
    pricing_model: string;
    category: string;
  };
}

export interface SendMessageResponse {
  messaging_product: string;
  contacts: {
    input: string;
    wa_id: string;
  }[];
  messages: {
    id: string;
  }[];
}

export interface TextMessage {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text';
  text: {
    preview_url?: boolean;
    body: string;
  };
}

export interface TemplateMessage {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'template';
  template: {
    name: string;
    language: {
      code: string;
    };
    components?: {
      type: 'header' | 'body' | 'button';
      parameters: any[];
    }[];
  };
}

export interface InteractiveMessage {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'interactive';
  interactive: {
    type: 'button' | 'list';
    header?: {
      type: 'text';
      text: string;
    };
    body: {
      text: string;
    };
    footer?: {
      text: string;
    };
    action: {
      buttons?: {
        type: 'reply';
        reply: {
          id: string;
          title: string;
        };
      }[];
      sections?: {
        title?: string;
        rows: {
          id: string;
          title: string;
          description?: string;
        }[];
      }[];
    };
  };
}

export interface MediaMessage {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'image' | 'audio' | 'document' | 'video';
  [key: string]: any; // For image/audio/document/video
} 