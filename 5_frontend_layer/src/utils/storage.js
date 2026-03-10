import { get, set, update } from 'idb-keyval';
import { encryptMessage, decryptMessage } from './crypto';

const MESSAGES_STORE_KEY = 'bridge_chat_messages';
const CONTACTS_STORE_KEY = 'bridge_chat_contacts';

export const getContacts = async () => {
    const customContacts = (await get(CONTACTS_STORE_KEY)) || [];
    return [
        { id: '1', name: 'Bridge AI Assistant', status: 'Online', avatar: '🤖' },
        ...customContacts
    ];
};

export const addContact = async (name) => {
    const newContact = {
        id: Date.now().toString(),
        name,
        status: 'Offline',
        avatar: name.charAt(0).toUpperCase()
    };
    await update(CONTACTS_STORE_KEY, (val) => {
        const contacts = val || [];
        contacts.push(newContact);
        return contacts;
    });
    return newContact;
};

export const saveMessage = async (messageObj, encryptionKey) => {
    // Encrypt sensitive content before saving
    const encryptedMsg = {
        ...messageObj,
        text: encryptMessage(messageObj.text, encryptionKey),
        // If there's transcribed text from audio, encrypt it too
        originalText: messageObj.originalText ? encryptMessage(messageObj.originalText, encryptionKey) : null,
    };

    await update(MESSAGES_STORE_KEY, (val) => {
        const messages = val || [];
        messages.push(encryptedMsg);
        return messages;
    });
};

export const getMessages = async (encryptionKey) => {
    const encryptedMessages = (await get(MESSAGES_STORE_KEY)) || [];

    // Decrypt content into memory
    return encryptedMessages.map(msg => ({
        ...msg,
        text: decryptMessage(msg.text, encryptionKey),
        originalText: msg.originalText ? decryptMessage(msg.originalText, encryptionKey) : null,
    }));
};

// Clear session credentials
export const clearSession = () => {
    sessionStorage.removeItem('bridge_auth_key');
    sessionStorage.removeItem('bridge_username');
};
