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
              isCurrent && "border-white/65 bg-white text-[#2148c0] shadow-[0_14px_28px_rgba(5,13,42,0.22)]",
              !isCurrent && isAnswered && "border-white/24 bg-white/[0.16] text-white",
              !isCurrent && !isAnswered && "border-white/12 bg-white/[0.04] text-white/72 hover:border-white/30 hover:bg-white/[0.08]"
            )}
          >
            {index + 1}
          </button>
        );
      })}
    </div>
  );
}
