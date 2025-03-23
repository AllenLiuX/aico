import os
import stripe
import logging
import json
from flask import Blueprint, request, jsonify, redirect
from util.redis_api import get_hash, write_hash
from util import user_logging
import redis
from util.coin_manager import get_user_coins, add_user_coins, use_user_coins, check_coin_balance
from keys import STRIPE_SECRET_KEY

# Set up logging
logger = logging.getLogger(__name__)

# Initialize Redis client
redis_client = redis.Redis(host='localhost', port=6379, db=0)
redis_version = '_v1'

# Initialize Stripe with your secret key
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY', STRIPE_SECRET_KEY)
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://aico-music.com')

payment_routes = Blueprint('payment_routes', __name__)

@payment_routes.route('/create-checkout', methods=['POST'])
def create_checkout_session():
    """Create a Stripe checkout session for purchasing coins"""
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return jsonify({"error": "Authentication required"}), 401

    # Extract token from Authorization header (handle Bearer token format)
    auth_token = auth_header
    if auth_header.startswith('Bearer '):
        auth_token = auth_header[7:]  # Remove 'Bearer ' prefix

    username = get_hash(f"sessions{redis_version}", auth_token)
    if not username:
        return jsonify({"error": "Invalid session"}), 401

    try:
        data = request.json
        package_id = data.get('packageId')
        coins = data.get('coins')
        price = data.get('price')
        coupon_code = data.get('couponCode')
        
        if not all([package_id, coins, price]):
            return jsonify({"error": "Missing required parameters"}), 400
        
        # Create checkout session parameters
        checkout_params = {
            'payment_method_types': ['card'],
            'line_items': [
                {
                    'price_data': {
                        'currency': 'usd',
                        'product_data': {
                            'name': f'Aico Coins - {package_id.capitalize()} Package',
                            'description': f'{coins} Aico Coins',
                        },
                        'unit_amount': int(float(price) * 100),  # Convert to cents
                    },
                    'quantity': 1,
                },
            ],
            'metadata': {
                'username': username,
                'coins': coins,
                'package_id': package_id
            },
            'mode': 'payment',
            'success_url': f'{FRONTEND_URL}/store?success=true&coins={coins}',
            'cancel_url': f'{FRONTEND_URL}/store?canceled=true',
        }
        
        # Apply coupon if provided
        if coupon_code == "AICOFREE":
            # Check if the coupon exists
            try:
                # Calculate the maximum discount percentage that would still result in at least $0.50
                price_in_dollars = float(price)
                min_price_in_dollars = 0.50
                
                # Calculate maximum discount percentage: (price - min_price) / price * 100
                max_discount_percent = min(90, int((price_in_dollars - min_price_in_dollars) / price_in_dollars * 100))
                
                # Ensure we have at least a 50% discount, but not more than 90%
                discount_percent = max(50, max_discount_percent)
                
                logger.info(f"Calculated discount percentage: {discount_percent}% for price ${price_in_dollars}")
                
                # Try to retrieve the coupon by ID first
                coupon_id = "AICOFREE"
                try:
                    # Try to retrieve existing coupon
                    aico_free_coupon = stripe.Coupon.retrieve(coupon_id)
                    
                    # If coupon exists but has a different percentage, update by deleting and recreating
                    if aico_free_coupon.percent_off != discount_percent:
                        stripe.Coupon.delete(coupon_id)
                        aico_free_coupon = stripe.Coupon.create(
                            id=coupon_id,
                            percent_off=discount_percent,
                            duration="once",
                            metadata={"description": f"{discount_percent}% discount for Aico Coins"}
                        )
                        logger.info(f"Updated AICOFREE coupon to {discount_percent}%: {aico_free_coupon.id}")
                    else:
                        logger.info(f"Found existing AICOFREE coupon: {aico_free_coupon.id}")
                        
                except stripe.error.InvalidRequestError:
                    # Coupon doesn't exist, so create it
                    aico_free_coupon = stripe.Coupon.create(
                        id=coupon_id,
                        percent_off=discount_percent,
                        duration="once",
                        metadata={"description": f"{discount_percent}% discount for Aico Coins"}
                    )
                    logger.info(f"Created AICOFREE coupon with {discount_percent}% discount: {aico_free_coupon.id}")
                
                # Add the coupon to the checkout session
                checkout_params['discounts'] = [{'coupon': aico_free_coupon.id}]
                logger.info(f"Applied AICOFREE coupon to checkout session for user {username}")
                
            except Exception as e:
                logger.error(f"Error applying coupon: {str(e)}")
                # Continue without the coupon if there's an error
        
        # Create the checkout session
        checkout_session = stripe.checkout.Session.create(**checkout_params)
        
        return jsonify({'url': checkout_session.url})
    
    except Exception as e:
        logger.error(f"Error creating checkout session: {str(e)}")
        return jsonify({"error": "Failed to create checkout session"}), 500

@payment_routes.route('/webhook', methods=['POST'])
def stripe_webhook():
    """Handle Stripe webhook events"""
    payload = request.data
    sig_header = request.headers.get('Stripe-Signature')
    
    # Get the webhook secret from environment variables
    webhook_secret = os.environ.get('STRIPE_WEBHOOK_SECRET', 'whsec_your_test_webhook_secret')
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError as e:
        # Invalid payload
        logger.error(f"Invalid payload: {str(e)}")
        return jsonify({"error": "Invalid payload"}), 400
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        logger.error(f"Invalid signature: {str(e)}")
        return jsonify({"error": "Invalid signature"}), 400
    
    # Handle the checkout.session.completed event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        
        # Get customer details from the session
        username = session.get('metadata', {}).get('username')
        coins_to_add = int(session.get('metadata', {}).get('coins', 0))
        
        if username and coins_to_add > 0:
            try:
                # Use the unified coin management system to add coins
                package_id = session.get('metadata', {}).get('package_id', 'standard')
                new_balance = add_user_coins(
                    username=username, 
                    amount=coins_to_add, 
                    reason=f"Purchased {coins_to_add} coins (package: {package_id})"
                )
                
                # Additional logging for the purchase
                user_logging.log_user_activity(
                    username=username,
                    action="purchase_coins",
                    details={
                        "coins_added": coins_to_add,
                        "package_id": package_id,
                        "payment_id": session.get('id'),
                        "new_balance": new_balance
                    }
                )
                
                logger.info(f"Added {coins_to_add} coins to user {username}. New balance: {new_balance}")
            except Exception as e:
                logger.error(f"Error updating user coins: {str(e)}")
    
    return jsonify({'status': 'success'})

@payment_routes.route('/get-user-coins', methods=['GET'])
def get_user_coins_route():
    """Get the current coin balance for a user"""
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return jsonify({"error": "Authentication required"}), 401

    # Extract token from Authorization header (handle Bearer token format)
    auth_token = auth_header
    if auth_header.startswith('Bearer '):
        auth_token = auth_header[7:]  # Remove 'Bearer ' prefix

    username = get_hash(f"sessions{redis_version}", auth_token)
    if not username:
        return jsonify({"error": "Invalid session"}), 401
    
    try:
        # Check for and fix any mismatches in coin balances
        check_result = check_coin_balance(username)
        
        # Get the current coin balance using the unified system
        coins = get_user_coins(username)
        
        return jsonify({
            "username": username,
            "coins": coins
        })
    except Exception as e:
        logger.error(f"Error getting user coins: {str(e)}")
        return jsonify({"error": "Failed to get user coins"}), 500

@payment_routes.route('/use-coins', methods=['POST'])
def use_coins():
    """Deduct coins from a user's balance when they spend them"""
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return jsonify({"error": "Authentication required"}), 401

    # Extract token from Authorization header (handle Bearer token format)
    auth_token = auth_header
    if auth_header.startswith('Bearer '):
        auth_token = auth_header[7:]  # Remove 'Bearer ' prefix

    username = get_hash(f"sessions{redis_version}", auth_token)
    if not username:
        return jsonify({"error": "Invalid session"}), 401
    
    try:
        data = request.json
        coins_to_use = data.get('coins')
        feature = data.get('feature')
        
        if not all([coins_to_use, feature]):
            return jsonify({"error": "Missing required parameters"}), 400
        
        # Use the unified coin management system to deduct coins
        result = use_user_coins(
            username=username,
            amount=int(coins_to_use),
            feature=feature
        )
        
        if not result["success"]:
            return jsonify(result), 400
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error using coins: {str(e)}")
        return jsonify({"error": "Failed to use coins"}), 500
