from google.cloud import firestore
from google.oauth2 import service_account
import random
import string
import os
import json
from datetime import datetime
from dotenv import load_dotenv

class FirestoreService:
    def __init__(self, collection_name='bot_registry'):
        """Initialize Firestore service"""
        try:
            # Load environment variables
            load_dotenv()
            
            # Create credentials from environment variables
            credentials_dict = {
                "type": os.getenv('FIREBASE_TYPE'),
                "project_id": os.getenv('FIREBASE_PROJECT_ID'),
                "private_key_id": os.getenv('FIREBASE_PRIVATE_KEY_ID'),
                "private_key": os.getenv('FIREBASE_PRIVATE_KEY').replace('\\n', '\n'),
                "client_email": os.getenv('FIREBASE_CLIENT_EMAIL'),
                "client_id": os.getenv('FIREBASE_CLIENT_ID'),
                "auth_uri": os.getenv('FIREBASE_AUTH_URI'),
                "token_uri": os.getenv('FIREBASE_TOKEN_URI'),
                "auth_provider_x509_cert_url": os.getenv('FIREBASE_AUTH_PROVIDER_CERT_URL'),
                "client_x509_cert_url": os.getenv('FIREBASE_CLIENT_CERT_URL'),
                "universe_domain": os.getenv('FIREBASE_UNIVERSE_DOMAIN')
            }
            
            # Validate that all required environment variables are present
            if not all(credentials_dict.values()):
                raise ValueError("Missing required Firebase environment variables. Check your .env file.")
            
            # Create credentials from dictionary
            credentials = service_account.Credentials.from_service_account_info(credentials_dict)
            
            # Initialize Firestore client
            self.db = firestore.Client(
                project=os.getenv('FIREBASE_PROJECT_ID'),
                credentials=credentials
            )
            self.collection_name = collection_name
            
            # Test connection
            self._test_connection()
            print("✓ Firestore service initialized successfully")
            
        except Exception as e:
            print(f"✗ Error initializing Firestore: {e}")
            raise e
    
    def _test_connection(self):
        """Test Firestore connection"""
        try:
            # Try to access the collection (this will create it if it doesn't exist)
            collection_ref = self.db.collection(self.collection_name)
            # Just check if we can reference it without errors
            list(collection_ref.limit(1).get())
        except Exception as e:
            raise Exception(f"Failed to connect to Firestore: {e}")

    def generate_unique_bot_id(self):
        """Generate a unique bot_id in format AGOS-BOT-XXXXXX"""
        max_attempts = 100
        
        for _ in range(max_attempts):
            # Generate 6 random uppercase letters/numbers
            suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            bot_id = f"AGOS-BOT-{suffix}"
            
            # Check if this bot_id already exists
            if not self.check_bot_id_exists(bot_id):
                return bot_id
        
        raise Exception("Unable to generate unique bot_id after maximum attempts")
    
    def generate_unique_serial_number(self):
        """Generate a unique serial number in format AGOS-SN-XXXXXX"""
        max_attempts = 100
        
        for _ in range(max_attempts):
            # Generate 6 random uppercase letters/numbers
            suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            serial_number = f"AGOS-SN-{suffix}"
            
            # Check if this serial number already exists
            if not self.check_serial_exists(serial_number):
                return serial_number
        
        raise Exception("Unable to generate unique serial number after maximum attempts")
    
    def check_bot_id_exists(self, bot_id):
        """Check if a bot_id already exists in Firestore"""
        try:
            doc_ref = self.db.collection(self.collection_name).document(bot_id)
            doc = doc_ref.get()
            return doc.exists
        except Exception as e:
            print(f"Error checking bot_id existence: {e}")
            return False
    
    def check_serial_exists(self, serial_number):
        """Check if a serial number already exists"""
        try:
            query = self.db.collection(self.collection_name).where('serial_number', '==', serial_number)
            docs = query.get()
            return len(docs) > 0
        except Exception as e:
            print(f"Error checking serial number existence: {e}")
            return False

    def add_bot(self, bot_data):
        """Add a new bot to Firestore"""
        try:
            bot_id = bot_data['bot_id']
            
            # Generate unique serial number if not provided
            if 'serial_number' not in bot_data or not bot_data['serial_number']:
                bot_data['serial_number'] = self.generate_unique_serial_number()
            
            # Add timestamp for when the bot was registered
            bot_data['created_at'] = datetime.now()
            
            doc_ref = self.db.collection(self.collection_name).document(bot_id)
            doc_ref.set(bot_data)
            print(f"✓ Bot {bot_id} added to Firestore with serial {bot_data['serial_number']}")
            
            # Return the bot data with proper formatting for API response
            bot_data_response = bot_data.copy()
            # Convert datetime objects to ISO format for JSON serialization
            if isinstance(bot_data_response.get('manufactured_on'), datetime):
                bot_data_response['manufactured_on'] = bot_data_response['manufactured_on'].isoformat()
            if isinstance(bot_data_response.get('created_at'), datetime):
                bot_data_response['created_at'] = bot_data_response['created_at'].isoformat()
            
            return bot_data_response
        except Exception as e:
            print(f"Error adding bot to Firestore: {e}")
            raise e
    
    def get_bot(self, bot_id):
        """Get a specific bot by bot_id"""
        try:
            doc_ref = self.db.collection(self.collection_name).document(bot_id)
            doc = doc_ref.get()
            
            if doc.exists:
                bot_data = doc.to_dict()
                # Ensure bot_id is included in the data
                bot_data['bot_id'] = bot_id
                return bot_data
            return None
        except Exception as e:
            print(f"Error getting bot from Firestore: {e}")
            return None
    
    def get_all_bots(self):
        """Get all bots from Firestore"""
        try:
            docs = self.db.collection(self.collection_name).get()
            bots = []
            
            for doc in docs:
                bot_data = doc.to_dict()
                bot_data['id'] = doc.id  # Add document ID
                # Ensure bot_id is included (use document ID if not present in data)
                if 'bot_id' not in bot_data:
                    bot_data['bot_id'] = doc.id
                
                # Ensure all expected fields exist with proper types
                if 'serial_number' not in bot_data:
                    bot_data['serial_number'] = None
                if 'hardware_version' not in bot_data:
                    bot_data['hardware_version'] = None
                if 'model' not in bot_data:
                    bot_data['model'] = None
                if 'manufactured_on' not in bot_data:
                    bot_data['manufactured_on'] = None
                    
                bots.append(bot_data)
            
            # Sort by created_at timestamp (newest first) - handle timezone issues
            def get_sort_key(bot):
                created_at = bot.get('created_at')
                if created_at is None:
                    return datetime.min
                if hasattr(created_at, 'replace'):
                    # If it's a datetime object, make it timezone-naive
                    return created_at.replace(tzinfo=None)
                return datetime.min
            
            bots.sort(key=get_sort_key, reverse=True)
            return bots
        except Exception as e:
            print(f"Error getting bots from Firestore: {e}")
            return []