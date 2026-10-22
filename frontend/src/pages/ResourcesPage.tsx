import { ArrowUpRight, Bookmark, BookOpen, Search } from "lucide-react";
import { useState } from "react";
import { api, errorMessage, post } from "../api";
import { useLoad } from "../hooks";
import type { Resource, Skill } from "../types";
import {
  Empty,
  ErrorNotice,
  formatDate,
  Loading,
  PageHeader,
  Panel,
} from "../components/ui";

export default function ResourcesPage() {
  const {
    data,
    setData,
    error: loadError,
    loading,
    reload,
  } = useLoad<Resource[]>("/resources");
  const skills = useLoad<Skill[]>("/skills");
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All topics"),
    [savedOnly, setSavedOnly] = useState(false),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const categories = Array.from(
    new Set(skills.data?.map((s) => s.category) ?? []),
  );
  const skillMap = new Map(skills.data?.map((s) => [s.id, s]));
  async function bookmark(resource: Resource) {
    setBusy(resource.id);
    setError("");
    try {
      if (resource.bookmarked)
        await api(`/resources/${resource.id}/bookmark`, { method: "DELETE" });
      else await post(`/resources/${resource.id}/bookmark`);
      setData((rows) =>
        rows?.map((r) =>
          r.id === resource.id ? { ...r, bookmarked: !r.bookmarked } : r,
        ),
      );
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }
  if (loading) return <Loading />;
  if (loadError) return <ErrorNotice message={loadError} retry={reload} />;
  const visible =
    data?.filter(
      (r) =>
        (!savedOnly || r.bookmarked) &&
        (filter === "All topics" ||
          skillMap.get(r.skill_id)?.category === filter) &&
        `${r.title} ${r.publisher} ${skillMap.get(r.skill_id)?.name}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    ) ?? [];
  return (
    <>
      <PageHeader
        eyebrow="GOOD SOURCES. LESS SEARCHING."
        title="A library with a little direction."
      >
        Primary documentation and learning material, connected to your
        preparation topics.
      </PageHeader>
      <div className="library-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Search resources"
            placeholder="Find a topic or resource…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button
          className={`filter-button ${savedOnly ? "selected" : ""}`}
          aria-pressed={savedOnly}
          onClick={() => setSavedOnly((v) => !v)}
        >
          <Bookmark size={16} />
          Saved resources
        </button>
      </div>
      <div className="filter-tabs" aria-label="Topic filters">
        {["All topics", ...categories].map((category) => (
          <button
            key={category}
            className={filter === category ? "selected" : ""}
            aria-pressed={filter === category}
            onClick={() => setFilter(category)}
          >
            {category}
          </button>
        ))}
      </div>
      {error ? <ErrorNotice message={error} /> : null}
      {visible.length ? (
        <div className="resource-grid">
          {visible.map((resource) => (
            <Panel key={resource.id} className="resource-card">
              <div className="resource-card-top">
                <span className="icon-tile">
                  <BookOpen size={22} />
                </span>
                <button
                  className={`icon-button ${resource.bookmarked ? "saved" : ""}`}
                  aria-label={`${resource.bookmarked ? "Remove bookmark for" : "Bookmark"} ${resource.title}`}
                  aria-pressed={resource.bookmarked}
                  disabled={!!busy}
                  onClick={() => {
                    void bookmark(resource);
                  }}
                >
                  <Bookmark
                    size={19}
                    fill={resource.bookmarked ? "currentColor" : "none"}
                  />
                </button>
              </div>
              <span className="eyebrow">
                {skillMap.get(resource.skill_id)?.category ??
                  "LEARNING RESOURCE"}
              </span>
              <h2>{resource.title}</h2>
              <p className="muted">{skillMap.get(resource.skill_id)?.name}</p>
              <div className="resource-meta">
                <span>{resource.publisher}</span>
                <span>{resource.difficulty}</span>
              </div>
              <a
                className="button secondary"
                href={resource.url}
                target="_blank"
                rel="noreferrer"
              >
                Open resource
                <ArrowUpRight size={17} />
              </a>
              <small className="muted">
                Catalogue review:{" "}
                {formatDate(resource.reviewed_on, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </small>
            </Panel>
          ))}
        </div>
      ) : (
        <Panel>
          <Empty title="A different search might help">
            Try another topic, or save a resource to find it here later.
          </Empty>
        </Panel>
      )}
    </>
  );
}
