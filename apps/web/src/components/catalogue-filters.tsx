import type { CatalogueQuery } from '../lib/catalog-query';

export function CatalogueFilters({ query, admin = false }: { query: CatalogueQuery; admin?: boolean }) {
  return <form className="filter-bar" method="get">
    <label>Search varieties<input name="q" type="search" defaultValue={query.q} maxLength={100} placeholder="Name or species" /></label>
    {admin && <label>Visibility<select name="visibility" defaultValue={query.visibility ?? ''}><option value="">All active</option><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select></label>}
    <label>Stock level<select name="stock" defaultValue={query.stock ?? ''}><option value="">All stock</option><option value="low">Low stock (1–5)</option><option value="out">None available</option><option value="unknown">Count needed</option></select></label>
    <label>Sort by<select name="sort" defaultValue={query.sort ?? ''}><option value="">Name</option><option value="stock">Available stock</option><option value="newest">Newest</option></select></label>
    <button className="button" type="submit">Apply filters</button>
  </form>;
}
export function Pagination({ query, page, total, pageSize }: { query: CatalogueQuery; page: number; total: number; pageSize: number }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (next: number) => `?${new URLSearchParams({ ...query, page: String(next) }).toString()}`;
  return <nav className="pagination" aria-label="Results pages"><span>{total} varieties · Page {page} of {pages}</span>{page > 1 && <a className="button" href={href(page - 1)}>Previous</a>}{page < pages && <a className="button" href={href(page + 1)}>Next</a>}</nav>;
}
