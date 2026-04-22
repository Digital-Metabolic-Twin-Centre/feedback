const coreItems = [
  {
    title: "Submit feedback",
    text: "Capture issues, requests, and notes with a consistent structure.",
  },
  {
    title: "Review faster",
    text: "Triage incoming items in one list without jumping across pages.",
  },
  {
    title: "Keep context",
    text: "Use threaded replies so decisions stay attached to the original item.",
  },
];

const quickNotes = [
  "Works for both internal and public submissions.",
  "Keeps the interface intentionally simple and reusable.",
  "Focuses on function first, with light visual styling.",
];

export default function HomePageIntro() {
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <article className="page-section p-4 md:p-6">
        <h3 className="text-xl font-semibold text-slate-900">What This Tool Does</h3>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          This feedback workspace is built to stay clear and practical. Teams can
          submit feedback, review records, and continue discussion in one place.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {coreItems.map((item) => (
            <div key={item.title} className="rounded-md border bg-white p-4">
              <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
            </div>
          ))}
        </div>
      </article>

      <aside className="page-section p-4 md:p-6">
        <h3 className="text-xl font-semibold text-slate-900">Quick Notes</h3>
        <div className="mt-3 space-y-3">
          {quickNotes.map((note) => (
            <p key={note} className="rounded-md border bg-white px-3 py-2 text-sm text-slate-600">
              {note}
            </p>
          ))}
        </div>
      </aside>
    </section>
  );
}
