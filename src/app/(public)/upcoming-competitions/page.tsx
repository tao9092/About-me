import{CollectionPage}from"@/components/collection-page";
// Static, served from the CDN and refreshed in the background (and at once when
// the admin changes content). A search (?q=) is rewritten to /search/upcoming-competitions.
export const revalidate=60;
export default function Page(){return <CollectionPage table="upcoming_competitions"/>}
