// Fabricated catalogue data only. No database connection or write operation.
const examples = [
  ['bean', 'Copper Lantern Bean', 'Phaseolus vulgaris', '3.25', 12, true],
  ['bean-climbing', 'Cloud Ladder Bean', 'Phaseolus vulgaris', '3.50', 2, true],
  ['broad-bean', 'Paper Harbour Broad Bean', 'Vicia faba', '2.90', 0, true],
  ['runner', 'Glass Bridge Runner', 'Phaseolus coccineus', null, null, true],
  ['kale', 'Silver Compass Kale', 'Brassica oleracea', '2.75', 18, true],
  ['collard', 'Ink Lantern Collard', 'Brassica oleracea', '2.80', 1, true],
  ['lettuce', 'Moon Envelope Lettuce', 'Lactuca sativa', '2.50', 24, true],
  ['spinach', 'Paper Tide Spinach', 'Spinacia oleracea', null, 6, true],
  ['leek', 'Clockwork Leek', 'Allium porrum', '3.00', 8, true],
  ['onion', 'Copper Kite Onion', 'Allium cepa', '2.95', 0, true],
  ['squash', 'Lantern Orbit Squash', 'Cucurbita maxima', '4.00', 4, true],
  ['courgette', 'Paper Comet Courgette', 'Cucurbita pepo', '3.20', 3, true],
  ['tomato', 'Glass Atlas Tomato', 'Solanum lycopersicum', '3.80', 10, true],
  ['cucumber', 'Cloud Dial Cucumber', 'Cucumis sativus', '3.10', null, true],
  ['parsnip', 'Silver Letter Parsnip', 'Pastinaca sativa', '2.60', 15, true],
  ['pea', 'Ink Harbour Pea', 'Pisum sativum', '3.00', 7, false],
  ['radish', 'Paper Beacon Radish', 'Raphanus sativus', null, null, false],
  ['chard', 'Copper Orbit Chard', 'Beta vulgaris', '2.70', 9, false],
] as const;

export function fictionalPilotCatalogue() {
  return examples.map(([id, name, species, price, stock, published]) => ({
    slug: `pilot-fictional-${id}`,
    name: `[FICTIONAL PILOT] ${name}`,
    species,
    description: 'Fabricated test listing. Not a real seed offering.',
    price,
    stock,
    published,
  }));
}
