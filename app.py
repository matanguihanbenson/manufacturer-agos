from flask import Flask, render_template, request, redirect, url_for, flash, send_file, jsonify
from datetime import datetime
import os

app = Flask(__name__)
app.secret_key = 'your-secret-key-here'  # Change this in production

# Configure static files
app.static_folder = 'static'
app.static_url_path = '/static'

# Initialize services with error handling
try:
    from firestore_service import FirestoreService
    from barcode_utils import generate_barcode
    db_service = FirestoreService()
    print("Successfully connected to Firestore!")
except Exception as e:
    print(f"Error initializing services: {e}")
    db_service = None

# Ensure barcode directory exists
os.makedirs('static/barcodes', exist_ok=True)

@app.route('/')
def index():
    """Single page application - serves everything on one page"""
    bots = []
    if db_service:
        try:
            bots = db_service.get_all_bots()
        except Exception as e:
            flash(f'Error loading bots: {str(e)}', 'error')
    return render_template('index.html', bots=bots)

@app.route('/api/register', methods=['POST'])
def api_register_bot():
    """API endpoint for bot registration"""
    if not db_service:
        return jsonify({'success': False, 'message': 'Database service not available'}), 500
        
    try:
        # Get form data with correct field names
        model = request.form.get('model')
        hardware_version = request.form.get('hardware_version')
        manufactured_on = datetime.strptime(request.form['manufactured_on'], '%Y-%m-%d')
        notes = request.form.get('notes', '')
        bot_id = request.form.get('bot_id')
        
        if not bot_id:
            bot_id = db_service.generate_unique_bot_id()
        
        # Generate barcode (for local storage/download, but don't save path to DB)
        barcode_path = generate_barcode(bot_id)
        
        # Prepare bot data - all fields for Firestore
        bot_data = {
            'bot_id': bot_id,
            'model': model,
            'hardware_version': float(hardware_version) if hardware_version else None,
            'manufactured_on': manufactured_on,
            'notes': notes
            # serial_number will be auto-generated in add_bot method
        }
        
        # Save to Firestore
        saved_bot = db_service.add_bot(bot_data)
        
        return jsonify({
            'success': True, 
            'message': f'Bot {bot_id} registered successfully!',
            'bot': saved_bot
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error registering bot: {str(e)}'}), 500

@app.route('/api/bots')
def api_get_bots():
    """API endpoint to get all bots"""
    if not db_service:
        return jsonify({'success': False, 'message': 'Database service not available'}), 500
        
    try:
        bots = db_service.get_all_bots()
        return jsonify({'success': True, 'bots': bots})
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error loading bots: {str(e)}'}), 500

@app.route('/api/bot/<bot_id>')
def api_get_bot(bot_id):
    """API endpoint to get a specific bot"""
    if not db_service:
        return jsonify({'success': False, 'message': 'Database service not available'}), 500
        
    try:
        bot = db_service.get_bot(bot_id)
        if bot:
            return jsonify({'success': True, 'bot': bot})
        else:
            return jsonify({'success': False, 'message': 'Bot not found'}), 404
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error loading bot: {str(e)}'}), 500

@app.route('/download_barcode/<bot_id>')
def download_barcode(bot_id):
    """Download barcode as PNG file"""
    try:
        barcode_path = f'static/barcodes/{bot_id}.png'
        if os.path.exists(barcode_path):
            return send_file(barcode_path, as_attachment=True, download_name=f'{bot_id}_barcode.png')
        else:
            flash('Barcode not found!', 'error')
            return redirect(url_for('index'))
    except Exception as e:
        flash(f'Error downloading barcode: {str(e)}', 'error')
        return redirect(url_for('index'))



if __name__ == '__main__':
    app.run(debug=True)
