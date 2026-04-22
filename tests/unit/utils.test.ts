import { cn } from "@/lib/utils";

describe("cn utility function", () => {
  it("merges multiple class names", () => {
    const result = cn("class1", "class2", "class3");
    expect(result).toBe("class1 class2 class3");
  });

  it("handles conditional classes with clsx", () => {
    const result = cn("base", false && "hidden", true && "visible");
    expect(result).toBe("base visible");
  });

  it("removes falsy values", () => {
    const result = cn("class1", null, undefined, false, "", "class2");
    expect(result).toBe("class1 class2");
  });

  it("merges conflicting Tailwind classes correctly", () => {
    // twMerge should keep the last conflicting class
    const result = cn("p-4", "p-8");
    expect(result).toBe("p-8");
  });

  it("handles object syntax", () => {
    const result = cn({
      "text-red-500": true,
      "text-blue-500": false,
      "font-bold": true,
    });
    expect(result).toContain("text-red-500");
    expect(result).toContain("font-bold");
    expect(result).not.toContain("text-blue-500");
  });

  it("handles array syntax", () => {
    const result = cn(["class1", "class2"], "class3");
    expect(result).toBe("class1 class2 class3");
  });

  it("handles empty input", () => {
    const result = cn();
    expect(result).toBe("");
  });

  it("merges conflicting margin classes", () => {
    const result = cn("m-2", "m-4");
    expect(result).toBe("m-4");
  });

  it("merges conflicting text size classes", () => {
    const result = cn("text-sm", "text-lg");
    expect(result).toBe("text-lg");
  });

  it("merges conflicting background color classes", () => {
    const result = cn("bg-red-500", "bg-blue-500");
    expect(result).toBe("bg-blue-500");
  });

  it("keeps non-conflicting classes", () => {
    const result = cn("p-4", "m-4", "text-red-500");
    expect(result).toBe("p-4 m-4 text-red-500");
  });

  it("handles complex conditional with Tailwind conflicts", () => {
    const isActive = true;
    const isDisabled = false;

    const result = cn(
      "base-class",
      "p-2",
      isActive && "p-4",
      isDisabled && "opacity-50",
      "text-sm",
      isActive && "text-lg"
    );

    expect(result).toBe("base-class p-4 text-lg");
  });

  it("handles mixed input types", () => {
    const result = cn(
      "class1",
      ["class2", "class3"],
      { class4: true, class5: false },
      "class6"
    );

    expect(result).toContain("class1");
    expect(result).toContain("class2");
    expect(result).toContain("class3");
    expect(result).toContain("class4");
    expect(result).not.toContain("class5");
    expect(result).toContain("class6");
  });

  it("handles responsive Tailwind classes", () => {
    const result = cn("text-sm", "md:text-lg", "lg:text-xl");
    expect(result).toBe("text-sm md:text-lg lg:text-xl");
  });

  it("handles hover and focus states", () => {
    const result = cn(
      "bg-blue-500",
      "hover:bg-blue-600",
      "focus:bg-blue-700"
    );
    expect(result).toBe("bg-blue-500 hover:bg-blue-600 focus:bg-blue-700");
  });

  it("merges conflicting width classes", () => {
    const result = cn("w-full", "w-1/2");
    expect(result).toBe("w-1/2");
  });

  it("merges conflicting height classes", () => {
    const result = cn("h-10", "h-20");
    expect(result).toBe("h-20");
  });

  it("handles dark mode classes", () => {
    const result = cn("bg-white", "dark:bg-black", "text-black", "dark:text-white");
    expect(result).toBe("bg-white dark:bg-black text-black dark:text-white");
  });
});
