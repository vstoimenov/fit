/** Google Maps links for the gym address: an embeddable map and turn-by-turn directions. */
export function mapLinks(address: string): { embed: string; directions: string } {
  const q = encodeURIComponent(address);
  return {
    embed: `https://www.google.com/maps?q=${q}&output=embed`,
    directions: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
  };
}
