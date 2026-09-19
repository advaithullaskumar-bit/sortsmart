/**
 * SortSmart Intelligence Core
 *
 * This layer sits between vision output and the user-facing recommendation.
 * It deliberately refuses to turn low-confidence perception into a confident
 * disposal instruction.
 */

export const DEFAULT_COMMUNITY_PROFILE = {
  name: 'Campus pilot',
  bins: ['Wet waste', 'Dry waste', 'E-waste', 'Hazardous waste'],
  wetKeywords: ['food', 'fruit', 'vegetable', 'peel', 'leaf', 'garden', 'organic', 'compost'],
  dryKeywords: ['plastic', 'paper', 'cardboard', 'metal', 'can', 'bottle', 'packaging', 'glass'],
  eWasteKeywords: ['phone', 'charger', 'cable', 'battery', 'laptop', 'earbud', 'electronic'],
  hazardousKeywords: ['battery', 'chemical', 'paint', 'medicine', 'needle', 'sharp'],
  confidenceThreshold: 72
};

const normalize = value => String(value || '').trim().toLowerCase();

function keywordMatch(item, keywords) {
  const text = normalize(item);
  return keywords.some(keyword => text.includes(keyword));
}

function policyBin(item, profile) {
  // Safety wins over convenience: batteries are hazardous even when they are
  // also technically e-waste.
  if (keywordMatch(item, profile.hazardousKeywords)) return 'Hazardous waste';
  if (keywordMatch(item, profile.eWasteKeywords)) return 'E-waste';
  if (keywordMatch(item, profile.wetKeywords)) return 'Wet waste';
  if (keywordMatch(item, profile.dryKeywords)) return 'Dry waste';
  return 'Uncertain';
}

function consequence(bin) {
  return {
    'Wet waste': 'Dry recyclables or packaging can contaminate composting.',
    'Dry waste': 'Food residue or moisture can spoil the recyclable batch.',
    'E-waste': 'Electronics should not enter household bins because they need specialist recovery.',
    'Hazardous waste': 'Unsafe handling can expose workers or damage processing equipment.',
    Uncertain: 'The item needs a human check before it enters a waste stream.'
  }[bin];
}

export function evaluateItem(rawItem, profile = DEFAULT_COMMUNITY_PROFILE) {
  const item = rawItem.item || rawItem.name || 'Unknown item';
  const modelBin = profile.bins.includes(rawItem.bin) ? rawItem.bin : 'Uncertain';
  const ruleBin = policyBin(item, profile);
  const confidence = Math.max(0, Math.min(100, Number(rawItem.confidence || 0)));
  const agreement = modelBin === ruleBin || modelBin === 'Uncertain' || ruleBin === 'Uncertain';
  const safetyCritical = ruleBin === 'Hazardous waste' || ruleBin === 'E-waste';
  const needsReview = confidence < profile.confidenceThreshold || !agreement || safetyCritical;
  const finalBin = needsReview ? (safetyCritical && agreement ? ruleBin : (agreement ? modelBin : 'Uncertain')) : modelBin;

  return {
    ...rawItem,
    item,
    bin: finalBin,
    policyBin: ruleBin,
    confidence,
    needsReview,
    decisionState: needsReview ? 'human-check' : 'ready-to-sort',
    wrong_bin_consequence: rawItem.wrong_bin_consequence || consequence(finalBin),
    nextAction: needsReview
      ? (finalBin === 'Uncertain' ? 'Ask a human or local waste authority to verify this item.' : `Verify this ${finalBin.toLowerCase()} recommendation before disposal.`)
      : `Place in the ${finalBin.toLowerCase()} bin.`
  };
}

export function buildSortingPlan(items, profile = DEFAULT_COMMUNITY_PROFILE) {
  const evaluated = items.map(item => evaluateItem(item, profile));
  const ordered = [...evaluated].sort((a, b) => {
    const priority = item => item.bin === 'Hazardous waste' || item.bin === 'E-waste' ? 0 : item.bin === 'Uncertain' ? 1 : 2;
    return priority(a) - priority(b);
  });
  const reviewCount = ordered.filter(item => item.needsReview).length;
  return {
    items: ordered,
    reviewCount,
    canAutoGuide: reviewCount === 0,
    overall_note: reviewCount
      ? `${reviewCount} item${reviewCount === 1 ? ' needs' : 's need'} human verification before sorting.`
      : 'All detected items agree with the community policy and are ready to sort.',
    sequence: ordered.map((item, index) => ({ step: index + 1, item: item.item, action: item.nextAction }))
  };
}

export function estimateContamination(items, observedBin, profile = DEFAULT_COMMUNITY_PROFILE) {
  const evaluated = items.map(item => evaluateItem(item, profile));
  const wrong = evaluated.filter(item => item.bin !== observedBin && item.bin !== 'Uncertain');
  const uncertain = evaluated.filter(item => item.bin === 'Uncertain');
  const score = evaluated.length ? Math.round(((wrong.length + uncertain.length * 0.5) / evaluated.length) * 100) : 0;
  return {
    contaminationScore: score,
    wrongStreamItems: wrong.map(item => item.item),
    uncertainItems: uncertain.map(item => item.item),
    intervention: score >= 35
      ? 'Add a bin-side visual guide and run a short targeted sorting challenge.'
      : 'Keep the current signage and monitor the next collection.'
  };
}
