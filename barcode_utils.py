import os

def generate_barcode(bot_id):
    """Generate a barcode image for the given bot_id"""
    try:
        # Import here to catch import errors
        from barcode import Code128
        from barcode.writer import ImageWriter
        
        # Ensure barcode directory exists
        barcode_dir = 'static/barcodes'
        os.makedirs(barcode_dir, exist_ok=True)
        
        # Generate barcode
        code = Code128(bot_id, writer=ImageWriter())
        
        # Save barcode image
        filename = f'{bot_id}.png'
        filepath = os.path.join(barcode_dir, filename)
        
        # Generate barcode with options
        options = {
            'module_width': 0.2,
            'module_height': 15.0,
            'quiet_zone': 6.5,
            'font_size': 10,
            'text_distance': 5.0,
            'background': 'white',
            'foreground': 'black',
        }
        
        code.save(filepath.replace('.png', ''), options=options)
        
        print(f"✓ Barcode generated for {bot_id}")
        # The barcode library automatically adds .png extension
        return f'static/barcodes/{filename}'
        
    except ImportError as e:
        print(f"✗ Missing barcode packages. Run: pip install python-barcode[images] Pillow")
        return None
    except Exception as e:
        print(f"✗ Error generating barcode: {e}")
        return None
