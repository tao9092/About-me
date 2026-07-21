import { createClient } from "@/lib/supabase/server";
import {
  createTaxonomyAction,
  deleteTaxonomyAction,
} from "@/app/actions/admin-meta";
import { Badge, EmptyState } from "@/components/ui";

export async function TaxonomyManager({
  kind,
}: {
  kind: "categories" | "tags";
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(kind)
    .select("*")
    .order("sort_order")
    .order("name_en");
  if (error) throw new Error(error.message);
  const title = kind === "categories" ? "Categories" : "Tags";
  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Organisation</p>
          <h1>{title}</h1>
          <p>Shared labels used across your achievement archive.</p>
        </div>
      </header>
      <section className="admin-panel">
        <h2>Add {kind === "categories" ? "category" : "tag"}</h2>
        <form action={createTaxonomyAction} className="meta-inline-form">
          <input type="hidden" name="kind" value={kind} />
          <label>
            English name <em aria-label="required">*</em>
            <input name="name_en" required minLength={2} />
          </label>
          <label>
            中文名称
            <input name="name_zh" />
          </label>
          <label>
            Sort order
            <input name="sort_order" type="number" min="0" defaultValue="0" />
          </label>
          <button className="button">Add</button>
        </form>
      </section>
      {!data?.length ? (
        <EmptyState
          title={`No ${kind} yet`}
          description={`Add the first ${kind === "categories" ? "category" : "tag"} above.`}
        />
      ) : (
        <section className="admin-panel">
          <div className="panel-heading">
            <h2>All {title.toLowerCase()}</h2>
            <Badge>{data.length} total</Badge>
          </div>
          <div className="taxonomy-list">
            {data.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.name_en}</strong>
                  <span>{item.name_zh || item.slug}</span>
                </div>
                <Badge>Order {item.sort_order}</Badge>
                <form action={deleteTaxonomyAction}>
                  <input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="id" value={item.id} />
                  <button className="button button-danger">Delete</button>
                </form>
              </article>
            ))}
          </div>
          <p className="admin-help">
            Items currently used by content cannot be deleted. Remove or migrate
            those relationships first.
          </p>
        </section>
      )}
    </>
  );
}
