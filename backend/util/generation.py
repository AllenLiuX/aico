import qrcode
from PIL import Image
from pathlib import Path

def generate_qr_code_with_logo(url, filename='qr_code_with_logo.png'):

    current_dir = Path(__file__).parent
    logo_path = current_dir / "logo.png"  # Replace with your logo's relative path

    # Create a QR Code instance
    qr = qrcode.QRCode(
        version=1,  # Controls the size of the QR Code
        error_correction=qrcode.constants.ERROR_CORRECT_H,  # High error correction to support logo
        box_size=10,  # Size of each box in the QR Code
        border=4,  # Thickness of the border
    )
    
    # Add the URL to the QR Code
    qr.add_data(url)
    qr.make(fit=True)

    # Create an image from the QR Code instance
    img = qr.make_image(fill='black', back_color='white').convert('RGB')

    # Load the logo
    logo = Image.open(logo_path)

    # Calculate the size of the logo
    logo_size = int(min(img.size) * 0.2)  # Logo will be 20% of the QR code size
    # logo = logo.resize((logo_size, logo_size), Image.ANTIALIAS)
    # Resize the logo using LANCZOS for high-quality resampling
    logo = logo.resize((2*logo_size, logo_size), Image.Resampling.LANCZOS)


    # Calculate position to place the logo at the center
    logo_position = (
        (img.size[0] - int(2*logo_size)) // 2,
        (img.size[1] - logo_size) // 2,
    )

    # Paste the logo onto the QR code
    img.paste(logo, logo_position, logo)

    # Save the image
    img.save(filename)
    print(f"QR code with logo generated and saved as '{filename}'.")

# Example usage
if __name__ == "__main__":
    # Use Path to make paths relative to the script
    current_dir = Path(__file__).parent
    url = "https://www.example.com"  # Replace with your URL
    url = 'http://aico-music.com/playroom?room_name=eason'
    
    # Make the logo path relative
    output_filename = current_dir / "qr_codes" / "qr_code_with_logo.png"  # Optionally specify the output path
    output_filename = Path(__file__).parent.parent.parent / 'frontend' / 'react_dj' / 'public' / 'images' / "qr_code_eason.png"
    print(output_filename)

    generate_qr_code_with_logo(url, output_filename)



# def generate_qr_code(url, filename='qr_code.png'):
#     # Create a QR Code instance
#     qr = qrcode.QRCode(
#         version=1,  # Controls the size of the QR Code
#         error_correction=qrcode.constants.ERROR_CORRECT_L,
#         box_size=10,  # Size of each box in the QR Code
#         border=4,  # Thickness of the border
#     )
    
#     # Add the URL to the QR Code
#     qr.add_data(url)
#     qr.make(fit=True)

#     # Create an image from the QR Code instance
#     img = qr.make_image(fill='black', back_color='white')

#     # Save the image
#     img.save(filename)
#     print(f"QR code generated and saved as '{filename}'.")

# # Example usage
# if __name__ == "__main__":
#     url = "https://www.example.com"  # Replace with your URL
#     generate_qr_code(url, filename='qr_codes/example.png')
