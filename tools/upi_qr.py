# upi_qr.py assets/qr/
# Writes one UPI QR code per "Chip in" amount (needs the qrcode package).
# The ID, name and amounts must match UPI in support.html.
import sys
from urllib.parse import quote
import qrcode
import qrcode.image.svg

UPI_ID = 'alabhya.vaibhav1997-1@okhdfcbank'
NAME = 'Alabhya Vaibhav'
NOTE = 'Chip in: Duck Hunt Finger Gun'
AMOUNTS = [50, 100, 150, 500]


def upi_link(amount):
    # The ID goes in raw: several UPI apps reject "%40" in place of "@".
    return f'upi://pay?pa={UPI_ID}&pn={quote(NAME)}&am={amount:.2f}&cu=INR&tn={quote(NOTE)}'


out = sys.argv[1]
for a in AMOUNTS:
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=2)
    qr.add_data(upi_link(a))
    qr.make_image(image_factory=qrcode.image.svg.SvgPathFillImage).save(f'{out}/upi-{a}.svg')
    print(a, upi_link(a))
