import { cn } from "@/utils/format";

export function QuestionPalette(props: {
  total: number;
  currentIndex: number;
  answeredQuestionIds: string[];
  questionIds: string[];
  onSelect: (index: number) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
      {props.questionIds.map((questionId, index) => {
        const isAnswered = props.answeredQuestionIds.includes(questionId);
        const isCurrent = index === props.currentIndex;

        return (
          <button
            key={questionId}
            type="button"
            onClick={() => props.onSelect(index)}
            className={cn(
              "rounded-2xl border px-3 py-2 text-sm font-semibold transition",
              isCurrent && "border-slate-950 bg-slate-950 text-white",
              !isCurrent && isAnswered && "border-accent bg-teal-50 text-accent",
              !isCurrent && !isAnswered && "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
            )}
          >
            {index + 1}
          </button>
        );
      })}
    </div>
  );
}
