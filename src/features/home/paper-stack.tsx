/**
 * Decorative hero illustration: three miniature CV pages in different styles.
 * Purely visual (aria-hidden). Replaced by real rendered template thumbnails in Phase 2.
 */
function Line({
  w,
  tone = 'bg-[#d9d4cb]',
  h = 'h-[5px]',
}: {
  w: string;
  tone?: string;
  h?: string;
}) {
  return <div className={`${h} rounded-full ${tone}`} style={{ width: w }} />;
}

function Bullets({ rows }: { rows: string[] }) {
  return (
    <div className="flex flex-col gap-[6px]">
      {rows.map((w, i) => (
        <div key={i} className="flex items-center gap-[6px]">
          <span className="size-[4px] shrink-0 rounded-full bg-[#b9b2a6]" />
          <Line w={w} />
        </div>
      ))}
    </div>
  );
}

function ClarityMini() {
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex flex-col gap-2">
        <div className="font-[Georgia,serif] text-[17px] leading-none font-semibold text-[#1b2a4a]">
          Imran Qureshi
        </div>
        <div className="text-[9px] font-semibold tracking-wide text-[#2a5db0] uppercase">
          Delivery Driver
        </div>
        <Line w="70%" h="h-[4px]" />
      </div>
      {['Work history', 'Licences'].map((t, k) => (
        <div key={t} className="flex flex-col gap-2">
          <div className="text-[8px] font-bold tracking-[0.12em] text-[#2a5db0] uppercase">{t}</div>
          <div className="h-px bg-[#2a5db0]/40" />
          <Line w="55%" tone="bg-[#9aa3b5]" />
          <Bullets rows={k === 0 ? ['92%', '84%', '76%'] : ['60%', '48%']} />
        </div>
      ))}
    </div>
  );
}

function MeridianMini() {
  return (
    <div className="grid h-full grid-cols-[1fr_38%]">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1.5">
          <div className="text-[16px] leading-none font-bold text-[#163b37]">Grace Mensah</div>
          <div className="text-[8.5px] text-[#4b6b67]">Primary School Teacher</div>
        </div>
        {[0, 1].map((k) => (
          <div key={k} className="flex flex-col gap-2">
            <div className="text-[8px] font-bold tracking-[0.1em] text-[#1e5a55] uppercase">
              {k === 0 ? 'Experience' : 'Education'}
            </div>
            <Line w="62%" tone="bg-[#9db1ad]" />
            <Bullets rows={k === 0 ? ['95%', '88%', '70%'] : ['80%']} />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 bg-[#e6efed] p-4">
        {['Contact', 'Skills'].map((t) => (
          <div key={t} className="flex flex-col gap-1.5">
            <div className="text-[7.5px] font-bold tracking-[0.1em] text-[#1e5a55] uppercase">
              {t}
            </div>
            <Line w="90%" tone="bg-[#b7cbc7]" />
            <Line w="70%" tone="bg-[#b7cbc7]" />
            <Line w="80%" tone="bg-[#b7cbc7]" />
          </div>
        ))}
      </div>
    </div>
  );
}

function HeritageMini() {
  return (
    <div className="flex h-full flex-col items-center gap-4 p-6">
      <div className="flex flex-col items-center gap-1.5">
        <div className="font-[Georgia,serif] text-[18px] leading-none tracking-wide text-[#2b2620]">
          Robert Hale
        </div>
        <div className="text-[7.5px] tracking-[0.2em] text-[#8a6a3a] uppercase">
          Operations Director
        </div>
      </div>
      <div className="h-px w-1/2 bg-[#c8b48f]" />
      {[0, 1].map((k) => (
        <div key={k} className="flex w-full flex-col gap-2">
          <div className="text-center text-[7.5px] tracking-[0.2em] text-[#8a6a3a] uppercase">
            {k === 0 ? 'Leadership' : 'Board roles'}
          </div>
          <Line w="100%" />
          <Line w="90%" />
          <Line w="96%" />
        </div>
      ))}
    </div>
  );
}

export function PaperStack() {
  return (
    <div aria-hidden className="relative mx-auto h-[400px] w-full max-w-[460px] sm:h-[460px]">
      <div className="shadow-page absolute top-10 left-0 h-[330px] w-[234px] -rotate-6 overflow-hidden rounded-[4px] bg-white sm:h-[380px] sm:w-[270px]">
        <HeritageMini />
      </div>
      <div className="shadow-page absolute top-0 right-0 h-[330px] w-[234px] rotate-[5deg] overflow-hidden rounded-[4px] bg-white sm:h-[380px] sm:w-[270px]">
        <MeridianMini />
      </div>
      <div className="shadow-page absolute top-14 left-1/2 h-[330px] w-[234px] -translate-x-1/2 overflow-hidden rounded-[4px] bg-white sm:h-[380px] sm:w-[270px]">
        <ClarityMini />
      </div>
    </div>
  );
}
