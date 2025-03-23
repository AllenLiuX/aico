# AICO Music Changelog

## [1.2.0] - 2025-03-22

### Added
- GitHub login button in the authentication modal (UI only, backend integration pending)
- Enhanced Google OAuth login flow with improved error handling
- Better avatar handling for Google-authenticated users

### Changed
- Simplified user authentication flow in the frontend
- Improved form state management in AuthModal using a single formData object
- Updated error icon in authentication modal from X to AlertCircle
- Increased profile avatar size from 100px to 140px for better visibility
- Simplified avatar URL handling logic

### Fixed
- Fixed playlist generation by reverting to the original implementation in llm_modules.py
- Fixed OpenAI API key configuration in gpt.py
- Resolved "y is not a function" error in Google OAuth integration
- Fixed inconsistent Redis API calls (using get_hash vs redis_api.get_hash)
- Removed unnecessary error handling in playlist generation that was causing issues
- Simplified avatar retrieval logic to fix Google avatar display issues

### Removed
- Removed complex Google avatar handling in backend routes
- Removed test files (test_gpt.py, test_playlist.py, mock_playlist.py) after successful testing
- Removed unnecessary UserContext dependency in AuthModal

## [1.1.0] - 2025-03-22

### Added
- Google login integration
- User avatar upload functionality

### Fixed
- Fixed avatar upload issues

## [1.0.0] - 2025-03-19

### Added
- Initial release of AICO Music
- Playlist generation using OpenAI API
- Room creation and management
- User authentication system
- Music playback via YouTube API
- User profiles and customization
