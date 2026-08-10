// Coarse classification used only to compute the social_media_sec aggregate.
// Package-name matching, no content inspection.
const SOCIAL_MEDIA_PACKAGES = new Set([
  'com.instagram.android',
  'com.facebook.katana',
  'com.facebook.lite',
  'com.twitter.android',
  'com.zhiliaoapp.musically', // TikTok
  'com.snapchat.android',
  'com.reddit.frontpage',
  'com.linkedin.android',
  'com.pinterest',
  'com.whatsapp',
]);

export function isSocialMediaPackage(packageName) {
  return SOCIAL_MEDIA_PACKAGES.has(packageName);
}
