import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, ArrowUpRight, BookOpen, CheckCircle2, FileText, ShieldCheck } from 'lucide-react';
import BrandLogo from '../BrandLogo';

export const LEGAL_LINKS = [
  {to:'/terms',label:'Όροι Χρήσης'},
  {to:'/privacy',label:'Πολιτική Απορρήτου'},
  {to:'/cookies',label:'Πολιτική Cookies'},
  {to:'/broadcaster-terms',label:'Όροι Broadcasters'},
  {to:'/agency-terms',label:'Όροι Agencies'},
  {to:'/payment-methods',label:'Τρόποι Πληρωμής'}
];

export default function LegalLayout({document: doc, children}) {
  return <div className="min-h-screen bg-[#080e10] text-white selection:bg-[#ccff00] selection:text-black">
    <Helmet>
      <title>{doc.title} | iRadiosGR</title>
      <meta name="description" content={doc.description}/>
    </Helmet>
    <div className="pointer-events-none fixed -right-52 top-0 h-[540px] w-[540px] rounded-full bg-[#ccff00]/[.045] blur-[130px]"/>
    <div className="relative mx-auto max-w-[1340px] px-4 pb-24 pt-8 sm:px-7 lg:px-10">
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-7">
        <Link to="/" aria-label="iRadiosGR - Αρχική" className="inline-flex items-center gap-3">
          <BrandLogo variant="full" title="iRadiosGR" className="h-10 w-[155px] object-contain object-left"/>
          <span className="hidden border-l border-white/15 pl-3 text-[10px] font-black uppercase tracking-[.18em] text-zinc-400 sm:inline">Legal Center</span>
        </Link>
        <Link to="/" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.04] px-4 py-2.5 text-xs font-bold text-zinc-200 hover:border-[#ccff00]/40 hover:text-white"><ArrowLeft size={15}/> Επιστροφή στο iRadios</Link>
      </header>
      <section className="relative mb-10 overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-[#192522] via-[#10191b] to-[#0b1012] px-6 py-11 sm:px-10 sm:py-14">
        <div className="pointer-events-none absolute -right-14 -top-32 h-80 w-80 rounded-full bg-[#ccff00]/[.08] blur-[70px]"/>
        <div className="relative max-w-4xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#ccff00]/20 bg-[#ccff00]/10 px-3.5 py-2 text-[10px] font-black uppercase tracking-[.16em] text-[#ccff00]"><ShieldCheck size={15}/> {doc.eyebrow}</span>
          <h1 className="mt-7 text-3xl font-black leading-[1.1] tracking-[-.045em] sm:text-5xl lg:text-6xl">{doc.title}</h1>
          <p className="mt-5 max-w-3xl text-sm leading-8 text-zinc-300 sm:text-base">{doc.intro}</p>
          <div className="mt-7 flex flex-wrap gap-3 text-[11px] font-semibold text-zinc-400">
            <span className="rounded-full border border-white/10 px-3 py-2">Τελευταία ενημέρωση: 15/11/2026</span>
            <span className="rounded-full border border-white/10 px-3 py-2">{doc.sections.length} ενότητες</span>
            <span className="rounded-full border border-white/10 px-3 py-2">iRadiosGR · ILUMA Digital Agency</span>
          </div>
        </div>
      </section>
      <div className="grid items-start gap-8 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-11">
        <aside className="lg:sticky lg:top-6">
          <nav aria-label="Περιεχόμενα νομικής σελίδας" className="rounded-3xl border border-white/10 bg-[#131a1b] p-5">
            <h2 className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-[.12em] text-[#ccff00]"><BookOpen size={16}/> Περιεχόμενα</h2>
            <ol className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
              {doc.sections.map((section, index)=><li key={section.title}>
                <a className="flex items-start gap-3 rounded-xl px-2 py-2 text-xs leading-5 text-zinc-400 transition hover:bg-white/[.06] hover:text-white" href={'#legal-'+(index+1)}>
                  <span className="w-5 shrink-0 font-black text-[#ccff00]">{String(index+1).padStart(2,'0')}</span><span>{section.title}</span>
                </a>
              </li>)}
            </ol>
          </nav>
        </aside>
        <main className="min-w-0">
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#ccff00]/20 bg-[#ccff00]/[.045] p-5 text-xs leading-6 text-zinc-300 sm:text-sm">
            <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-[#ccff00]"/>
            <p>Το παρόν κείμενο εφαρμόζεται μαζί με τις ειδικές συμφωνίες και τις πληροφορίες που εμφανίζονται πριν από κάθε συναλλαγή. Καμία διάταξή του δεν περιορίζει δικαιώματα που παρέχει αναγκαστικό δίκαιο.</p>
          </div>
          <div className="space-y-4">
            {doc.sections.map((section,index)=><section key={section.title} id={'legal-'+(index+1)}
              className="scroll-mt-8 rounded-[26px] border border-white/[.09] bg-[#131a1b]/90 p-5 sm:p-8">
              <div className="mb-5 flex items-start gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#ccff00]/20 bg-[#ccff00]/[.07] text-sm font-black text-[#ccff00]">{String(index+1).padStart(2,'0')}</span>
                <h2 className="pt-1.5 text-lg font-black tracking-tight text-white sm:text-xl">{section.title}</h2>
              </div>
              <div className="space-y-3 text-sm leading-7 text-zinc-300 sm:text-[15px] sm:leading-8">
                {section.paragraphs?.map((paragraph,i)=><p key={i}>{paragraph}</p>)}
                {section.bullets?.length>0&&<ul className="list-disc space-y-2 pl-5 marker:text-[#ccff00]">{section.bullets.map((item,i)=><li key={i}>{item}</li>)}</ul>}
              </div>
            </section>)}
          </div>
          {children}
          <section className="mt-8 rounded-[26px] border border-white/10 bg-[#151d1c] p-6 sm:p-8">
            <div className="flex items-center gap-2 text-[#ccff00]"><FileText size={20}/><h2 className="text-lg font-black text-white">Σχετικά έγγραφα</h2></div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {LEGAL_LINKS.filter(link=>link.label!==doc.title).map(link=><Link key={link.to} to={link.to}
                className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[.025] px-4 py-3 text-xs font-semibold text-zinc-300 hover:border-[#ccff00]/30 hover:text-white">{link.label}<ArrowUpRight size={15}/></Link>)}
            </div>
          </section>
        </main>
      </div>
      <footer className="mt-12 flex flex-wrap justify-between gap-3 border-t border-white/10 pt-7 text-xs text-zinc-500">
        <span>© {new Date().getFullYear()} ILUMA Digital Agency · iRadiosGR</span>
        <a href="https://backstage.iluma.gr" target="_blank" rel="noopener noreferrer" className="hover:text-white">Επικοινωνία και υποστήριξη</a>
      </footer>
    </div>
  </div>;
}
