/** Session-memory IDs only: initial load is a baseline, never a new-message alert. */
export function unseenInquiryIds(previous:ReadonlySet<string>|null,rows:readonly {id:string}[]){return previous===null?[]:[...new Set(rows.map(row=>row.id))].filter(id=>!previous.has(id));}
