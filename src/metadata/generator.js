/**
 * Metadata generation module for platform-specific titles, descriptions, and captions
 * @module metadata/generator
 */

const { generateSeedValue } = require('../video/utils');

/**
 * Generates platform-specific metadata for videos
 * @param {Object} metaInput - Input metadata
 * @param {string} [metaInput.style] - Style identifier
 * @param {number} [metaInput.seed] - Seed for deterministic generation
 * @param {string} [metaInput.colorProfile] - Color profile description
 * @returns {Object} Object containing all platform-specific metadata
 */
function generateMetadata(metaInput = {}) {
  const {
    style = 'default',
    seed = Date.now(),
    colorProfile = 'vibrant'
  } = metaInput;

  // Title templates for YouTube
  const titleTemplates = [
    'Satisfying Loop Video #{num} - Infinity Loop',
    'Mesmerizing {style} Loop - Watch Again & Again',
    'Perfect {style} Infinity Loop - So Satisfying!',
    'Infinite {style} Loop - Never Ending Satisfaction',
    'Satisfying {style} Animation Loop - Relaxing',
    'Perfect Loop #{num} - {style} Style',
    'Infinity {style} Loop - Hypnotic & Satisfying'
  ];

  // Description templates for YouTube
  const descriptionTemplates = [
    `Watch this satisfying infinity loop video! Perfect for relaxation and stress relief.

This {style}-style loop creates a mesmerizing effect that you can watch over and over again.

#Satisfying #Loop #InfinityLoop #Relaxing #ASMR #SatisfyingVideos #LoopVideo #Meditation #Zen #Calm #Peaceful #Hypnotic #Mesmerizing #OddlySatisfying #SatisfyingLoop #InfiniteLoop #SatisfyingContent #RelaxingVideo #StressRelief #Mindfulness`,

    `Experience the perfect infinity loop! This {style} loop video is designed to be watched repeatedly.

The seamless loop creates a calming, hypnotic effect that helps you relax and unwind.

#Satisfying #InfinityLoop #Loop #Relaxing #ASMR #SatisfyingVideos #LoopVideo #Meditation #Zen #Calm #Peaceful #Hypnotic #Mesmerizing #OddlySatisfying #SatisfyingLoop #InfiniteLoop #SatisfyingContent #RelaxingVideo #StressRelief #Mindfulness #SatisfyingLoopVideo`,

    `This {style} infinity loop is incredibly satisfying to watch! The perfect loop creates an endless, mesmerizing experience.

Watch it again and again - you'll never get tired of this satisfying loop!

#Satisfying #Loop #InfinityLoop #Relaxing #ASMR #SatisfyingVideos #LoopVideo #Meditation #Zen #Calm #Peaceful #Hypnotic #Mesmerizing #OddlySatisfying #SatisfyingLoop #InfiniteLoop #SatisfyingContent #RelaxingVideo #StressRelief #Mindfulness`
  ];

  // Instagram caption templates
  const instagramCaptionTemplates = [
    `✨ Satisfying infinity loop ✨\n\nWatch this mesmerizing {style} loop over and over again! Perfect for relaxation and stress relief. 😌\n\n#Satisfying #InfinityLoop #Loop #Relaxing #ASMR #SatisfyingVideos #LoopVideo #Meditation #Zen #Calm #Peaceful #Hypnotic #Mesmerizing #OddlySatisfying #SatisfyingLoop #InfiniteLoop #SatisfyingContent #RelaxingVideo #StressRelief #Mindfulness`,

    `🎯 Perfect infinity loop!\n\nThis {style} loop creates a hypnotic, calming effect. Watch it again and again - you'll never get tired! 🔄\n\n#Satisfying #Loop #InfinityLoop #Relaxing #ASMR #SatisfyingVideos #LoopVideo #Meditation #Zen #Calm #Peaceful #Hypnotic #Mesmerizing #OddlySatisfying #SatisfyingLoop #InfiniteLoop #SatisfyingContent #RelaxingVideo #StressRelief #Mindfulness`,

    `🌀 Mesmerizing loop video 🌀\n\nExperience the perfect {style} infinity loop! So satisfying to watch! ✨\n\n#Satisfying #InfinityLoop #Loop #Relaxing #ASMR #SatisfyingVideos #LoopVideo #Meditation #Zen #Calm #Peaceful #Hypnotic #Mesmerizing #OddlySatisfying #SatisfyingLoop #InfiniteLoop #SatisfyingContent #RelaxingVideo #StressRelief #Mindfulness`
  ];

  // TikTok caption templates
  const tiktokCaptionTemplates = [
    `Satisfying infinity loop! Watch this {style} loop over and over 🔄 #satisfying #loop #infinityloop #relaxing #asmr #satisfyingvideos #loopvideo #meditation #zen #calm #peaceful #hypnotic #mesmerizing #oddlysatisfying #satisfyingloop #infiniteloop #satisfyingcontent #relaxingvideo #stressrelief #mindfulness`,

    `Perfect loop! This {style} infinity loop is so satisfying to watch ✨ #satisfying #loop #infinityloop #relaxing #asmr #satisfyingvideos #loopvideo #meditation #zen #calm #peaceful #hypnotic #mesmerizing #oddlysatisfying #satisfyingloop #infiniteloop #satisfyingcontent #relaxingvideo #stressrelief #mindfulness`,

    `Mesmerizing infinity loop! Watch it again and again 🌀 #satisfying #loop #infinityloop #relaxing #asmr #satisfyingvideos #loopvideo #meditation #zen #calm #peaceful #hypnotic #mesmerizing #oddlysatisfying #satisfyingloop #infiniteloop #satisfyingcontent #relaxingvideo #stressrelief #mindfulness`
  ];

  // Common tags for YouTube
  const tagSets = [
    ['satisfying', 'loop', 'infinity loop', 'relaxing', 'ASMR', 'satisfying videos', 'loop video', 'meditation', 'zen', 'calm', 'peaceful', 'hypnotic', 'mesmerizing', 'oddly satisfying', 'satisfying loop', 'infinite loop', 'satisfying content', 'relaxing video', 'stress relief', 'mindfulness'],
    ['satisfying', 'loop', 'infinity loop', 'relaxing', 'ASMR', 'satisfying videos', 'loop video', 'meditation', 'zen', 'calm', 'peaceful', 'hypnotic', 'mesmerizing', 'oddly satisfying', 'satisfying loop', 'infinite loop', 'satisfying content', 'relaxing video', 'stress relief', 'mindfulness', 'satisfying loop video', 'perfect loop'],
    ['satisfying', 'loop', 'infinity loop', 'relaxing', 'ASMR', 'satisfying videos', 'loop video', 'meditation', 'zen', 'calm', 'peaceful', 'hypnotic', 'mesmerizing', 'oddly satisfying', 'satisfying loop', 'infinite loop', 'satisfying content', 'relaxing video', 'stress relief', 'mindfulness', 'satisfying loop video', 'perfect loop', 'endless loop']
  ];

  // Select templates deterministically based on seed
  const titleIndex = generateSeedValue(seed, 0, titleTemplates.length - 1);
  const descIndex = generateSeedValue(seed + 1, 0, descriptionTemplates.length - 1);
  const instaIndex = generateSeedValue(seed + 2, 0, instagramCaptionTemplates.length - 1);
  const tiktokIndex = generateSeedValue(seed + 3, 0, tiktokCaptionTemplates.length - 1);
  const tagIndex = generateSeedValue(seed + 4, 0, tagSets.length - 1);
  const num = generateSeedValue(seed + 5, 1, 999);

  // Replace placeholders in templates
  const youtubeTitle = titleTemplates[titleIndex]
    .replace('{style}', style)
    .replace('{num}', num.toString());

  const youtubeDescription = descriptionTemplates[descIndex]
    .replace(/{style}/g, style);

  const instagramCaption = instagramCaptionTemplates[instaIndex]
    .replace(/{style}/g, style);

  const tiktokCaption = tiktokCaptionTemplates[tiktokIndex]
    .replace(/{style}/g, style);

  const youtubeTags = tagSets[tagIndex];

  return {
    youtubeTitle,
    youtubeDescription,
    youtubeTags,
    instagramCaption,
    tiktokCaption
  };
}

module.exports = {
  generateMetadata
};

